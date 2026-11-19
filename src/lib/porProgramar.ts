// Panel «Por programar»: lo que todavía no tiene día.
// - Órdenes activas con un plazo a menos de 30 días (o ya vencido) y SIN visita futura.
// - Tareas sin fecha (las «para la oficina» no: esas van al lunes).
// Primero las órdenes, de la más urgente a la menos; después las tareas por prioridad.
import type { Evento } from './eventos'
import type { Orden } from './ordenes'
import { proximoPlazo, type ContextoPlazos, type PlazoCalc } from './plazos/motor'
import { pesoPrioridad, type Tarea } from './tareas'

export const DIAS_POR_PROGRAMAR = 30

export type ItemPorProgramar = { tipo: 'orden'; orden: Orden; plazo: PlazoCalc } | { tipo: 'tarea'; tarea: Tarea }

/** Órdenes con alguna visita pendiente desde hoy */
export function ordenesConVisitaFutura(eventos: readonly Pick<Evento, 'orden_id' | 'tipo' | 'fecha' | 'estado'>[], hoy: string): Set<string> {
  const s = new Set<string>()
  for (const e of eventos) if (e.orden_id && e.tipo === 'visita' && e.estado === 'pendiente' && e.fecha >= hoy) s.add(e.orden_id)
  return s
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

/** Próxima visita pendiente de cada orden (desde hoy) */
export function proximasVisitas(eventos: readonly Evento[], hoy: string): Map<string, Evento> {
  const m = new Map<string, Evento>()
  for (const e of eventos) {
    if (!e.orden_id || e.tipo !== 'visita' || e.estado !== 'pendiente' || e.fecha < hoy) continue
    const prev = m.get(e.orden_id)
    if (!prev || e.fecha < prev.fecha || (e.fecha === prev.fecha && (e.hora_inicio ?? '') < (prev.hora_inicio ?? ''))) m.set(e.orden_id, e)
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
