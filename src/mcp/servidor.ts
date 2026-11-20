// El servidor MCP: registra las herramientas y traduce sus resultados al formato de MCP.
// Se crea uno NUEVO en cada petición (la función de Supabase no guarda estado entre peticiones).
import { McpServer } from '@modelcontextprotocol/server'
import { ErrorHerramienta, nuevoCtx, type DatosMcp } from './comun'
import { HERRAMIENTAS_ESCRITURA } from './escritura'
import { anotaciones, type Herramienta } from './herramienta'
import { HERRAMIENTAS_INFORMES } from './informes'
import { HERRAMIENTAS_LECTURA } from './lectura'
import { recortar } from './formato'
import { relojReal, type Reloj } from './reloj'
import { registrar } from './registro'

export const VERSION = '1.0.0'

/** Todas las herramientas. NO hay ninguna de borrar ni ninguna que ejecute SQL. */
export const HERRAMIENTAS: readonly Herramienta[] = [...HERRAMIENTAS_LECTURA, ...HERRAMIENTAS_ESCRITURA, ...HERRAMIENTAS_INFORMES] as unknown as Herramienta[]

const INSTRUCCIONES = `Servidor de la app «Inspecciones» de una subinspectora (órdenes de inspección, plazos, visitas y tareas). Responde siempre en castellano.
- Fechas en formato aaaa-mm-dd y en hora de España. «Hoy» lo calcula el servidor.
- Semana de trabajo: el lunes es día de oficina; las visitas se hacen en domingo y en lunes.
- Privacidad: pide lo mínimo. NO pidas notas, detalles, direcciones ni teléfonos (incluir_detalles) salvo que la usuaria lo pida expresamente.
- Antes de crear o cambiar algo, confirma con la usuaria lo que vas a hacer. Para identificar órdenes usa buscar_ordenes y su id.
- Al marcar una visita, NO actualices la orden (actualizar_orden) salvo que ella lo diga expresamente.
- No se puede borrar nada desde aquí: para borrar, que lo haga ella en la app.`

export function crearServidorMcp(datos: DatosMcp, reloj: Reloj = relojReal): McpServer {
  const server = new McpServer({ name: 'inspecciones', title: 'Inspecciones', version: VERSION }, { instructions: INSTRUCCIONES })
  for (const h of HERRAMIENTAS) {
    server.registerTool(
      h.nombre,
      { title: h.titulo, description: h.descripcion, inputSchema: h.entrada, annotations: { title: h.titulo, ...anotaciones(h.clase) } },
      async (args: unknown) => {
        const t0 = Date.now()
        try {
          // «Hoy» se calcula en CADA llamada, con la hora de España
          const texto = await h.ejecutar(args as never, nuevoCtx(datos, reloj))
          registrar({ herramienta: h.nombre, ok: true, ms: Date.now() - t0 })
          return { content: [{ type: 'text' as const, text: recortar(texto) }] }
        } catch (e) {
          const propio = e instanceof ErrorHerramienta
          registrar({ herramienta: h.nombre, ok: false, ms: Date.now() - t0, error: propio ? 'usuario' : 'interno' })
          // Errores sin detalles internos: solo los mensajes pensados para ella
          const texto = propio ? e.message : 'No se ha podido completar. Inténtalo de nuevo en un momento.'
          return { content: [{ type: 'text' as const, text: texto }], isError: true }
        }
      },
    )
  }
  return server
}
