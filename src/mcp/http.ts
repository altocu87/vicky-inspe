// La parte «HTTP» del servidor: quién puede entrar y cuánto.
// 1. withOAuthProtectedResource: le dice a ChatGPT dónde iniciar sesión (Supabase Auth de la app).
// 2. withSupabase({ auth: 'user' }): comprueba la firma y caducidad del token y crea un cliente con ESA sesión (RLS).
// 3. comprobarIdentidad (aquí): además exige que el token venga de una conexión OAuth (no una sesión de la web
//    copiada), que la sesión siga viva en Supabase (si revocas el permiso, deja de funcionar al momento)
//    y, si se configura, que el asistente sea uno de los permitidos.
// 4. Límite de peticiones por minuto y por hora, y de tamaño de cada petición.
// Nunca se usa la clave de servicio (service_role): todo va con la sesión de la usuaria.
import { createMcpHandler } from '@modelcontextprotocol/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DatosMcp } from './comun'
import { registrar } from './registro'
import { crearServidorMcp } from './servidor'
import { relojReal, type Reloj } from './reloj'

/** Quién llama, ya comprobado */
export interface Identidad {
  /** id del usuario (solo para el límite de peticiones; no se registra) */
  usuario: string
  clienteId: string
  datos: DatosMcp
}

export const MAX_CUERPO = 64 * 1024

const json = (status: number, mensaje: string, cabeceras: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: mensaje }), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...cabeceras } })

/** Límite de peticiones en memoria (por instancia de la función; es un freno, no una garantía absoluta) */
export class Limitador {
  private marcas = new Map<string, number[]>()
  private porMinuto: number
  private porHora: number
  private ahora: () => number
  constructor(porMinuto: number, porHora: number, ahora: () => number = Date.now) {
    this.porMinuto = porMinuto
    this.porHora = porHora
    this.ahora = ahora
  }
  /** Segundos que hay que esperar (0 = puede pasar) */
  esperar(clave: string): number {
    const t = this.ahora()
    const l = (this.marcas.get(clave) ?? []).filter((x) => t - x < 3_600_000)
    const ultMin = l.filter((x) => t - x < 60_000)
    if (ultMin.length >= this.porMinuto) return Math.ceil((60_000 - (t - ultMin[0])) / 1000)
    if (l.length >= this.porHora) return Math.ceil((3_600_000 - (t - l[0])) / 1000)
    l.push(t)
    this.marcas.set(clave, l)
    if (this.marcas.size > 1000) this.marcas.delete(this.marcas.keys().next().value!)
    return 0
  }
}

export interface OpcionesAtender {
  reloj?: Reloj
  limitador?: Limitador
}

/** Atiende una petición MCP de alguien ya identificado */
export function crearAtender(op: OpcionesAtender = {}) {
  const reloj = op.reloj ?? relojReal
  const limitador = op.limitador ?? new Limitador(60, 600)
  return async (req: Request, id: Identidad): Promise<Response> => {
    const espera = limitador.esperar(id.usuario)
    if (espera > 0) {
      registrar({ evento: 'limite' })
      return json(429, 'Demasiadas peticiones seguidas. Espera un poco.', { 'retry-after': String(espera) })
    }
    const largo = Number(req.headers.get('content-length') ?? '0')
    if (largo > MAX_CUERPO) {
      registrar({ evento: 'demasiado_grande' })
      return json(413, 'Petición demasiado grande.')
    }
    const handler = createMcpHandler(() => crearServidorMcp(id.datos, reloj), {
      maxRequestBodySize: MAX_CUERPO,
      onerror: () => registrar({ evento: 'error', motivo: 'mcp' }),
    })
    return handler.fetch(req)
  }
}

/** Lo que se comprueba del token, además de su firma (eso ya lo ha hecho withSupabase) */
export interface ComprobarOpciones {
  /** Ids de cliente OAuth permitidos (vacío = cualquiera que haya aceptado ella en la pantalla de permiso) */
  clientesPermitidos: readonly string[]
}

export async function comprobarIdentidad(
  req: Request,
  supabase: Pick<SupabaseClient, 'auth'>,
  claims: Record<string, unknown> | null,
  crearDatos: () => DatosMcp,
  op: ComprobarOpciones,
): Promise<Identidad | Response> {
  const clienteId = typeof claims?.client_id === 'string' ? claims.client_id : null
  const usuario = typeof claims?.sub === 'string' ? claims.sub : null
  if (!usuario || claims?.role !== 'authenticated') {
    registrar({ evento: 'rechazada', motivo: 'sin_usuario' })
    return json(401, 'Sesión no válida.')
  }
  // Solo tokens emitidos por la conexión OAuth (los de la web no llevan client_id)
  if (!clienteId) {
    registrar({ evento: 'rechazada', motivo: 'no_oauth' })
    return json(403, 'Este servidor solo admite la conexión autorizada desde ChatGPT.')
  }
  if (op.clientesPermitidos.length && !op.clientesPermitidos.includes(clienteId)) {
    registrar({ evento: 'rechazada', motivo: 'cliente_no_permitido' })
    return json(403, 'Este asistente no está autorizado.')
  }
  // La sesión debe seguir viva en Supabase (si se revoca el permiso o se borra el usuario, se corta ya)
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user || data.user.id !== usuario) {
    registrar({ evento: 'rechazada', motivo: 'sesion_caducada' })
    // Sin cabecera propia: withOAuthProtectedResource añade el «WWW-Authenticate» para que ChatGPT vuelva a pedir permiso
    return json(401, 'La sesión ha caducado o se ha revocado. Vuelve a conectar.')
  }
  return { usuario, clienteId, datos: crearDatos() }
}
