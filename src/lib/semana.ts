// La semana de trabajo de la subinspectora:
// el LUNES es día de oficina; las visitas se hacen el DOMINGO y el LUNES.
import { addDias, diaSemana, esIso } from './fechas'
import type { MapaFestivos } from './habiles'
import type { Evento } from './eventos'
import type { Tarea } from './tareas'

export const DIA_OFICINA = 1 // lunes
export const DIAS_VISITA: readonly number[] = [0, 1] // domingo y lunes

export const esOficina = (iso: string) => diaSemana(iso) === DIA_OFICINA
export const esDiaVisita = (iso: string) => DIAS_VISITA.includes(diaSemana(iso))

/** Cuántas visitas caben en un día para considerarlo «libre» (se puede cambiar si hace falta) */
export const VISITAS_POR_DIA = 4

/** Visitas pendientes por día */
export function visitasPorDia(eventos: readonly Pick<Evento, 'tipo' | 'fecha' | 'estado'>[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of eventos) if (e.tipo === 'visita' && e.estado === 'pendiente') m.set(e.fecha, (m.get(e.fecha) ?? 0) + 1)
  return m
}

/**
 * Próximo domingo o lunes «libre» a partir de `desde` (incluido): que no sea festivo
 * y que tenga menos de `capacidad` visitas pendientes. Busca como mucho un año.
 */
export function proximoHuecoVisita(
  desde: string,
  ocupacion: ReadonlyMap<string, number>,
  festivos: MapaFestivos,
  capacidad = VISITAS_POR_DIA,
): string {
  if (!esIso(desde)) throw new Error('Fecha no válida')
  let d = desde
  for (let i = 0; i < 370; i++, d = addDias(d, 1)) {
    if (!esDiaVisita(d) || festivos.has(d)) continue
    if ((ocupacion.get(d) ?? 0) < capacidad) return d
  }
  // Si todo está lleno (no debería pasar), el primer día de visita
  d = desde
  while (!esDiaVisita(d)) d = addDias(d, 1)
  return d
}

/** Próximo lunes (hoy, si hoy es lunes) */
export function proximoLunes(desde: string): string {
  let d = desde
  while (!esOficina(d)) d = addDias(d, 1)
  return d
}

/**
 * Tareas «para la oficina» que tocan un lunes concreto (solo en lunes, y no hechas):
 * - el PRÓXIMO lunes (hoy, si hoy es lunes): las que no tienen fecha y las que vencían antes;
 * - un lunes posterior: las que vencen esa semana (del martes anterior a ese lunes);
 * - un lunes pasado: ninguna (ya salen en su día como tareas normales).
 */
export function tareasOficina(tareas: readonly Tarea[], lunes: string, hoy: string): Tarea[] {
  if (!esOficina(lunes)) return []
  const proximo = proximoLunes(hoy)
  if (lunes < proximo) return []
  const pend = tareas.filter((t) => t.oficina && !t.hecha)
  if (lunes === proximo) return pend.filter((t) => !t.vence || t.vence <= lunes)
  return pend.filter((t) => t.vence && t.vence > addDias(lunes, -7) && t.vence <= lunes)
}
