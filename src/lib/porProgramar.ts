// Panel «Por programar»: lo que todavía no tiene día.
// - Órdenes activas con un plazo a menos de 30 días (o ya vencido) y SIN visita futura.
// - Tareas sin fecha (las «para la oficina» no: esas van al lunes).
// Primero las órdenes, de la más urgente a la menos; después las tareas por prioridad.
import type { Evento } from './eventos'
import { addDias, diasEntre } from './fechas'
import { diasDeSerie } from './repeticion'
import type { Orden } from './ordenes'
import { proximoPlazo, type ContextoPlazos, type PlazoCalc } from './plazos/motor'
import { pesoPrioridad, type Tarea } from './tareas'

export const DIAS_POR_PROGRAMAR = 30

export type ItemPorProgramar = { tipo: 'orden'; orden: Orden; plazo: PlazoCalc } | { tipo: 'tarea'; tarea: Tarea }

/**
 * Lo que hay que cargar para saber las visitas futuras: visitas pendientes desde hoy, las visitas
 * que se repiten (aunque empezaran antes de hoy) y las excepciones de sus días desde hoy
 * (aunque estén canceladas o hechas, para no contar ese día de la serie).
 */
export function esVisitaFuturaOSerie(e: Evento, hoy: string): boolean {
  if (e.tipo !== 'visita' || !e.orden_id) return false
  if (e.serie_id) return (e.ocurrencia_original ?? '') >= hoy || (e.estado === 'pendiente' && e.fecha >= hoy)
  return e.estado === 'pendiente' && (e.fecha >= hoy || !!e.rrule)
}

/** Hasta dónde se busca el siguiente día de una visita que se repite */
const HORIZONTE_SERIE = 5 * 366

/** Primer día desde hoy de una serie, sin los días quitados ni los sustituidos por una excepción */
function primerDiaDeSerie(e: Evento, hoy: string, sustituidos: ReadonlySet<string>): string | null {
  const quitados = new Set(e.exdates)
  for (const d of diasDeSerie(e.fecha, e.rrule!, hoy, addDias(hoy, HORIZONTE_SERIE), 600)) {
    if (!quitados.has(d) && !sustituidos.has(`${e.id}@${d}`)) return d
  }
  return null
}

/** Órdenes con alguna visita pendiente desde hoy (incluidas las visitas que se repiten) */
export function ordenesConVisitaFutura(eventos: readonly Evento[], hoy: string): Set<string> {
  return new Set(proximasVisitas(eventos, hoy).keys())
}

export function porProgramar(
  ordenes: readonly Orden[],
  tareas: readonly Tarea[],
  visitasFuturas: ReadonlySet<string>,
  ctx: ContextoPlazos,
): ItemPorProgramar[] {
  const ords: ItemPorProgramar[] = []
  for (const o of ordenes) {
    if (o.estado === 'FINALIZADA' || visitasFuturas.has(o.id)) continue
    const p = proximoPlazo(o, ctx)
    if (p && p.dias < DIAS_POR_PROGRAMAR) ords.push({ tipo: 'orden', orden: o, plazo: p })
  }
  ords.sort((a, b) => (a.tipo === 'orden' && b.tipo === 'orden' ? a.plazo.dias - b.plazo.dias || a.orden.num_orden.localeCompare(b.orden.num_orden, 'es') : 0))
  const tars: ItemPorProgramar[] = tareas
    .filter((t) => !t.hecha && !t.vence && !t.oficina)
    .sort((a, b) => pesoPrioridad(a.prioridad) - pesoPrioridad(b.prioridad) || a.titulo.localeCompare(b.titulo, 'es'))
    .map((tarea) => ({ tipo: 'tarea', tarea }))
  return [...ords, ...tars]
}

/**
 * Próxima visita pendiente de cada orden (desde hoy). Las visitas que se repiten se despliegan:
 * cuenta su siguiente día (se devuelve una copia con `fecha` de ese día), aunque la serie empezara antes.
 */
export function proximasVisitas(eventos: readonly Evento[], hoy: string): Map<string, Evento> {
  const m = new Map<string, Evento>()
  const sustituidos = new Set<string>()
  for (const e of eventos) if (e.serie_id && e.ocurrencia_original) sustituidos.add(`${e.serie_id}@${e.ocurrencia_original}`)
  for (const s of eventos) {
    if (!s.orden_id || s.tipo !== 'visita' || s.estado !== 'pendiente') continue
    let e = s
    if (s.rrule && !s.serie_id) {
      const d = primerDiaDeSerie(s, hoy, sustituidos)
      if (!d) continue
      e = d === s.fecha ? s : { ...s, fecha: d, fecha_fin: s.fecha_fin ? addDias(d, diasEntre(s.fecha, s.fecha_fin)) : null }
    } else if (s.fecha < hoy) continue
    const prev = m.get(s.orden_id)
    if (!prev || e.fecha < prev.fecha || (e.fecha === prev.fecha && (e.hora_inicio ?? '') < (prev.hora_inicio ?? ''))) m.set(s.orden_id, e)
  }
  return m
}

/**
 * Semáforo de la «Próxima visita» frente al próximo plazo:
 * - ok: la visita está programada antes del plazo
 * - tarde: la visita cae después del plazo
 * - falta: no hay visita y el plazo vence en menos de 30 días
 * - nada: ni visita ni prisa
 */
export type Semaforo = 'ok' | 'tarde' | 'falta' | 'nada'
export function semaforoVisita(visita: Pick<Evento, 'fecha'> | undefined, plazo: Pick<PlazoCalc, 'fecha' | 'dias'> | null): Semaforo {
  if (visita) return plazo && visita.fecha > plazo.fecha ? 'tarde' : 'ok'
  return plazo && plazo.dias < DIAS_POR_PROGRAMAR ? 'falta' : 'nada'
}
