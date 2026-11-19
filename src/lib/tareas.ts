// Tareas (tabla `tareas`): lo que hay que hacer, con o sin fecha.
import { addDias, edate, esIso } from './fechas'
import { RE_UUID } from './eventos'

export const PRIORIDADES = ['alta', 'media', 'baja'] as const
export type Prioridad = (typeof PRIORIDADES)[number]
export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export const REPETICIONES = ['no', 'diaria', 'semanal', 'quincenal', 'mensual'] as const
export type Repeticion = (typeof REPETICIONES)[number]
export const NOMBRE_REPETICION: Record<Repeticion, string> = {
  no: 'No se repite',
  diaria: 'Cada día',
  semanal: 'Cada semana',
  quincenal: 'Cada 2 semanas',
  mensual: 'Cada mes',
}

export interface Tarea {
  id: string
  titulo: string
  notas: string | null
  orden_id: string | null
  /** Día de vencimiento; null = sin fecha («Por programar») */
  vence: string | null
  hora: string | null
  duracion_min: number | null
  prioridad: Prioridad
  hecha: boolean
  hecha_el: string | null
  repeticion: Repeticion
  /** Para hacerla en la oficina (el lunes) */
  oficina: boolean
  created_at?: string
  updated_at?: string
}

export type TareaInput = Omit<Tarea, 'id' | 'created_at' | 'updated_at'>

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export function leerTarea(f: unknown): Tarea | null {
  if (!f || typeof f !== 'object') return null
  const r = f as Record<string, unknown>
  if (typeof r.id !== 'string' || !RE_UUID.test(r.id)) return null
  const titulo = texto(r.titulo, 200)
  if (!titulo) return null
  const vence = esIso(r.vence) ? r.vence : null
  const hora = vence && typeof r.hora === 'string' && RE_HORA.test(r.hora) ? r.hora.slice(0, 5) : null
  const dur = hora && Number.isInteger(r.duracion_min) && (r.duracion_min as number) >= 5 && (r.duracion_min as number) <= 1440 ? (r.duracion_min as number) : null
  return {
    id: r.id,
    titulo,
    notas: texto(r.notas, 4000),
    orden_id: typeof r.orden_id === 'string' && RE_UUID.test(r.orden_id) ? r.orden_id.toLowerCase() : null,
    vence,
    hora,
    duracion_min: dur,
    prioridad: (PRIORIDADES as readonly string[]).includes(r.prioridad as string) ? (r.prioridad as Prioridad) : 'media',
    hecha: r.hecha === true,
    hecha_el: esIso(r.hecha_el) ? r.hecha_el : null,
    repeticion: vence && (REPETICIONES as readonly string[]).includes(r.repeticion as string) ? (r.repeticion as Repeticion) : 'no',
    oficina: r.oficina === true,
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  }
}

export function tareaNueva(p: Partial<TareaInput> = {}): TareaInput {
  return {
    titulo: '',
    notas: null,
    orden_id: null,
    vence: null,
    hora: null,
    duracion_min: null,
    prioridad: 'media',
    hecha: false,
    hecha_el: null,
    repeticion: 'no',
    oficina: false,
    ...p,
  }
}

/** Siguiente vencimiento de una tarea que se repite (null si no se repite) */
export function siguienteVencimiento(vence: string, r: Repeticion): string | null {
  switch (r) {
    case 'diaria':
      return addDias(vence, 1)
    case 'semanal':
      return addDias(vence, 7)
    case 'quincenal':
      return addDias(vence, 14)
    case 'mensual':
      return edate(vence, 1)
    default:
      return null
  }
}

/**
 * Cambios al marcar una tarea como hecha. Si se repite, no se cierra: pasa a la siguiente fecha
 * (posterior a hoy, para no dejar repeticiones atrasadas).
 */
export function cambiosAlHacer(t: Tarea, hoy: string): Partial<TareaInput> {
  if (t.vence && t.repeticion !== 'no') {
    let v = siguienteVencimiento(t.vence, t.repeticion)!
    for (let i = 0; v <= hoy && i < 1000; i++) v = siguienteVencimiento(v, t.repeticion)!
    return { vence: v, hecha: false, hecha_el: hoy }
  }
  return { hecha: true, hecha_el: hoy }
}

const PESO: Record<Prioridad, number> = { alta: 0, media: 1, baja: 2 }
export const pesoPrioridad = (p: Prioridad) => PESO[p]
