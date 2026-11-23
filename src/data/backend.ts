// Tipos comunes de la capa de datos (sin nada del navegador ni de Vite):
// los usa la web (api.ts) y el servidor MCP para ChatGPT (src/mcp).
import type { Session } from '@supabase/supabase-js'
import type { Orden } from '../lib/ordenes'
import type { Festivo } from '../lib/habiles'
import type { ReglaFila } from '../lib/plazos/reglas'
import type { Evento, EventoInput, TipoCita } from '../lib/eventos'
import type { Tarea, TareaInput } from '../lib/tareas'
import type { CambioHistorial } from '../lib/historial'

export type Resultado<T> = { data: T; error: null } | { data: null; error: string }

export interface Backend {
  sesion(): Promise<Session | null>
  alCambiarSesion(fn: (s: Session | null) => void): () => void
  entrar(email: string, password: string): Promise<string | null>
  /** Cierra la sesión. Devuelve null si fue bien, o un aviso si solo se pudo cerrar en este navegador */
  salir(): Promise<string | null>
  listarOrdenes(): Promise<Resultado<Orden[]>>
  crearOrden(payload: Partial<Orden>): Promise<Resultado<Orden>>
  actualizarOrden(id: string, payload: Partial<Orden>): Promise<Resultado<Orden>>
  eliminarOrden(id: string): Promise<string | null>
  listarFestivos(desde: string, hasta: string): Promise<Resultado<Festivo[]>>
  guardarFestivo(f: Festivo): Promise<string | null>
  eliminarFestivo(fecha: string): Promise<string | null>
  listarReglas(): Promise<Resultado<ReglaFila[]>>
  guardarRegla(r: Partial<ReglaFila> & { id: string }): Promise<string | null>
  activarRegla(id: string, base: boolean, activa: boolean): Promise<string | null>
  eliminarRegla(id: string): Promise<string | null>
  // ---- Fase 2: visitas y citas (eventos), tareas y tipos de cita ----
  /** Eventos que se ven entre dos días: los que caen dentro, las series que ya empezaron y sus excepciones */
  listarEventos(desde: string, hasta: string): Promise<Resultado<Evento[]>>
  /** Visitas pendientes desde hoy enlazadas a una orden, más las que se repiten y sus excepciones (para «Próxima visita» y «Por programar») */
  listarVisitasFuturas(hoy: string): Promise<Resultado<Evento[]>>
  /** Citas no canceladas de unos tipos (para las reglas de plazo que cuentan desde una cita) */
  listarEventosDeTipos(tipos: string[]): Promise<Resultado<Evento[]>>
  /** Visitas, citas y tareas de una orden */
  listarAgendaOrden(ordenId: string): Promise<Resultado<{ eventos: Evento[]; tareas: Tarea[] }>>
  crearEvento(e: EventoInput): Promise<Resultado<Evento>>
  actualizarEvento(id: string, cambios: Partial<EventoInput>): Promise<Resultado<Evento>>
  eliminarEvento(id: string): Promise<string | null>
  /** Tareas con fecha entre dos días, más las pendientes sin fecha o atrasadas */
  listarTareas(desde: string, hasta: string): Promise<Resultado<Tarea[]>>
  crearTarea(t: TareaInput): Promise<Resultado<Tarea>>
  actualizarTarea(id: string, cambios: Partial<TareaInput>): Promise<Resultado<Tarea>>
  eliminarTarea(id: string): Promise<string | null>
  /** Cambios guardados de una orden (los escribe la base de datos; aquí solo se leen) */
  listarHistorial(ordenId: string): Promise<Resultado<CambioHistorial[]>>
  /** Una visita o cita por su id (null si no existe o no se puede ver) */
  obtenerEvento(id: string): Promise<Resultado<Evento | null>>
  /** Una tarea por su id (null si no existe o no se puede ver) */
  obtenerTarea(id: string): Promise<Resultado<Tarea | null>>
  listarTipos(): Promise<Resultado<TipoCita[]>>
  guardarTipo(t: TipoCita): Promise<string | null>
  // ---- Conexión de asistentes (ChatGPT) por OAuth: pantalla de permiso y lista de conexiones ----
  /** Qué pide el asistente (o, si ya diste permiso antes, a dónde volver) */
  oauthDetalles(authorizationId: string): Promise<Resultado<DetallesPermiso>>
  /** Permitir o denegar; devuelve la dirección a la que hay que volver */
  oauthDecidir(authorizationId: string, permitir: boolean): Promise<Resultado<string>>
  listarConexiones(): Promise<Resultado<Conexion[]>>
  revocarConexion(clientId: string): Promise<string | null>
}

/** Lo que pide un asistente al conectarse */
export type DetallesPermiso =
  | { tipo: 'pedir'; cliente: string; clienteId: string; redirectUri: string; email: string }
  | { tipo: 'volver'; url: string }

/** Un asistente con permiso concedido */
export interface Conexion {
  clientId: string
  nombre: string
  desde: string
}

/** Mensaje de error comprensible, sin detalles internos de la base de datos */
export function mensajeError(e: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!e) return 'Error desconocido'
  // Sesión caducada o no válida (PostgREST: PGRST301/PGRST303; Auth: 401, bad_jwt, session_expired…)
  if (
    e.status === 401 ||
    ['PGRST301', 'PGRST303', 'bad_jwt', 'session_expired', 'session_not_found', 'refresh_token_not_found'].includes(e.code ?? '') ||
    /jwt expired/i.test(e.message ?? '')
  )
    return 'Tu sesión ha caducado. Vuelve a entrar.'
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message ?? '')) return 'No tienes permiso para esta acción. Vuelve a iniciar sesión.'
  if (e.code === '23505') return 'Ya existe un registro igual.'
  if (e.code === '23514') return 'Algún dato no es válido.'
  if (e.code === '23503') return 'Falta un dato relacionado (la orden o el tipo de cita ya no existe).'
  if (e.code === '42P01' || e.code === 'PGRST205') return 'Esta parte aún no está activada en la base de datos.'
  if (/fetch|network/i.test(e.message ?? '')) return 'Sin conexión. Inténtalo de nuevo.'
  return e.message ?? 'Error desconocido'
}

/**
 * Mensaje del inicio de sesión según el error de Supabase Auth (sin el punto final: lo pone Login).
 * Antes todo era «Correo o contraseña incorrectos», también sin internet o tras muchos intentos.
 */
export function mensajeLogin(e: { name?: string; status?: number; code?: string; message?: string }): string {
  const msg = e.message ?? ''
  if (e.name === 'AuthRetryableFetchError' || e.status === 0 || /failed to fetch|fetch failed|network|load failed/i.test(msg))
    return 'No hay conexión con el servidor. Comprueba internet e inténtalo de nuevo'
  if (e.status === 429 || e.code === 'over_request_rate_limit' || /rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera unos minutos y vuelve a probar'
  if (e.code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return 'Correo o contraseña incorrectos'
  if (e.code === 'email_not_confirmed') return 'Tu correo aún no está confirmado'
  return 'No se pudo entrar ahora mismo. Inténtalo de nuevo en un rato'
}
