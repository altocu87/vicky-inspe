// Cómo se escriben las respuestas: texto corto y claro en castellano, con lo justo.
// Por defecto NO salen notas libres, direcciones ni teléfonos (solo si se piden expresamente).
import { diasEntre, nombreDia } from '../lib/fechas'
import { textoInhabil } from '../lib/habiles'
import { label, type Orden } from '../lib/ordenes'
import type { PlazoCalc } from '../lib/plazos/motor'
import { NOMBRE_ESTADO_EVENTO, textoHora, type Evento, type TipoCita } from '../lib/eventos'
import { NOMBRE_PRIORIDAD, type Tarea } from '../lib/tareas'

/** Tamaño máximo de una respuesta (caracteres). Lo que pase se recorta con aviso. */
export const MAX_RESPUESTA = 15_000

/** «23/11/2026» */
export const dma = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '—')

/** «lun 23/11/2026» */
export const diaYFecha = (iso: string) => `${nombreDia(iso)} ${dma(iso)}`

/** «hoy», «mañana», «en 5 días», «hace 3 días» */
export function cuando(iso: string, hoy: string): string {
  const d = diasEntre(hoy, iso)
  if (d === 0) return 'hoy'
  if (d === 1) return 'mañana'
  if (d === -1) return 'ayer'
  return d > 0 ? `en ${d} días` : `hace ${-d} días`
}

/** «2024/123 · TALLERES SL · En curso» */
export const lineaOrden = (o: Pick<Orden, 'num_orden' | 'empresa' | 'estado'>) => `${o.num_orden} · ${o.empresa} · ${label(o.estado)}`

/** «9 meses: 12/01/2027 (en 53 días)» con aviso si cae en día inhábil */
export function textoPlazo(p: PlazoCalc, hoy: string): string {
  const estado = p.dias < 0 ? `VENCIDO ${cuando(p.fecha, hoy)}` : cuando(p.fecha, hoy)
  return `${p.regla.corto}: ${dma(p.fecha)} (${estado})${p.inhabil ? ` · ${textoInhabil(p.inhabil).toLowerCase()}` : ''}`
}

/** Una visita o cita en una línea. Dirección, teléfono y notas solo con `detalles` */
export function lineaEvento(e: Evento, fecha: string, tipos: ReadonlyMap<string, TipoCita>, orden: Orden | undefined, detalles: boolean, conFecha = true): string {
  const tipo = tipos.get(e.tipo)?.nombre ?? e.tipo
  const partes = [conFecha ? `${diaYFecha(fecha)} ${textoHora(e)}` : textoHora(e), e.titulo && e.titulo.toLowerCase() !== tipo.toLowerCase() ? `${tipo}: ${e.titulo}` : tipo]
  if (orden) partes.push(`${orden.num_orden} · ${orden.empresa}`)
  partes.push(NOMBRE_ESTADO_EVENTO[e.estado].toLowerCase())
  if (e.rrule) partes.push('se repite')
  let t = partes.join(' · ') + ` · id visita: ${e.id}`
  if (detalles) {
    if (e.ubicacion) t += `\n    Dirección: ${e.ubicacion}`
    if (e.telefono) t += `\n    Teléfono: ${e.telefono}`
    if (e.notas) t += `\n    Detalles: ${e.notas}`
  }
  return t
}

/** Una tarea en una línea. Notas solo con `detalles` */
export function lineaTarea(t: Tarea, orden: Orden | undefined, detalles: boolean): string {
  const partes = [t.vence ? `${diaYFecha(t.vence)}${t.hora ? ' ' + t.hora : ''}` : 'sin fecha', t.titulo, `prioridad ${NOMBRE_PRIORIDAD[t.prioridad].toLowerCase()}`]
  if (t.oficina) partes.push('para la oficina')
  if (orden) partes.push(`${orden.num_orden} · ${orden.empresa}`)
  if (t.hecha) partes.push(`hecha el ${dma(t.hecha_el)}`)
  let s = partes.join(' · ') + ` · id tarea: ${t.id}`
  if (detalles && t.notas) s += `\n    Notas: ${t.notas}`
  return s
}

/** Recorta la respuesta si es muy larga (y lo dice) */
export function recortar(texto: string, max = MAX_RESPUESTA): string {
  if (texto.length <= max) return texto
  const corte = texto.lastIndexOf('\n', max - 120)
  return texto.slice(0, corte > 0 ? corte : max - 120) + '\n… (respuesta recortada por tamaño: pide menos resultados o un rango más corto)'
}

/** «N elementos» con «y X más» si se ha limitado */
export function pieLimite(total: number, mostrados: number): string {
  return total > mostrados ? `\n(Se muestran ${mostrados} de ${total}. Pide más con «limite» o afina la búsqueda.)` : ''
}
