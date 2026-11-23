// Cómo se mezcla en memoria lo que llega del servidor con lo que ya había (agenda de visitas/citas y tareas).
// Reglas (auditoría #10):
//  - Ante dos versiones de lo mismo, gana la de «updated_at» más reciente (una respuesta lenta no pisa un cambio nuevo).
//  - Lo borrado hace poco se ignora aunque llegue en una respuesta tardía.
//  - Al recargar un rango, lo que estaba en ese rango y ya no viene se quita (lo borraron en otro sitio),
//    salvo lo que se ha tocado aquí mientras tanto.
import type { Evento } from './eventos'
import type { Tarea } from './tareas'

type ConId = { id: string; updated_at?: string }

/** ¿Hay que sustituir la versión que tenemos (p) por la que llega (x)? */
function masNueva(p: ConId | undefined, x: ConId): boolean {
  if (!p) return true
  if (!p.updated_at || !x.updated_at) return p.updated_at !== x.updated_at || p.updated_at === undefined
  return x.updated_at > p.updated_at
}

/** Mete o actualiza elementos; si nada cambia, devuelve el MISMO mapa (evita repintar en bucle) */
export function juntar<T extends ConId>(m: Map<string, T>, lista: readonly T[], borrados?: ReadonlySet<string>): Map<string, T> {
  const nuevos = lista.filter((x) => !borrados?.has(x.id) && masNueva(m.get(x.id), x))
  if (!nuevos.length) return m
  const n = new Map(m)
  for (const x of nuevos) n.set(x.id, x)
  return n
}

/**
 * Sustituye lo de una consulta: quita lo que `enConsulta` dice que debería haber venido y no ha venido
 * (salvo los `protegidos`: tocados aquí después de lanzar la consulta) y luego junta lo recibido.
 */
export function sustituir<T extends ConId>(
  m: Map<string, T>,
  lista: readonly T[],
  enConsulta: (x: T) => boolean,
  borrados?: ReadonlySet<string>,
  protegidos?: ReadonlySet<string>,
): Map<string, T> {
  const llegan = new Set(lista.map((x) => x.id))
  const quitar = [...m.values()].filter((x) => !llegan.has(x.id) && !protegidos?.has(x.id) && enConsulta(x))
  const base = quitar.length ? new Map([...m].filter(([k]) => !quitar.some((q) => q.id === k))) : m
  return juntar(base, lista, borrados)
}

/** Lo que devuelve listarEventos(desde, hasta) (misma condición que la consulta) */
export const eventoEnRango = (desde: string, hasta: string) => (e: Evento) =>
  (e.fecha >= desde && e.fecha <= hasta) ||
  (e.fecha < desde && !!e.fecha_fin && e.fecha_fin >= desde) ||
  (!!e.rrule && e.fecha <= hasta) ||
  (!!e.serie_id && !!e.ocurrencia_original && e.ocurrencia_original >= desde && e.ocurrencia_original <= hasta)

/** Lo que devuelve listarTareas(desde, hasta) */
export const tareaEnRango = (desde: string, hasta: string) => (t: Tarea) =>
  (!!t.vence && t.vence >= desde && t.vence <= hasta) || (!t.hecha && (!t.vence || t.vence < desde))

/** Lo que devuelve listarVisitasFuturas(hoy) */
export const visitaFutura = (hoy: string) => (e: Evento) => e.tipo === 'visita' && e.estado === 'pendiente' && e.fecha >= hoy && !!e.orden_id

/** Lo que devuelve listarEventosDeTipos(tipos) */
export const eventoDeTipos = (tipos: readonly string[]) => (e: Evento) => tipos.includes(e.tipo) && e.estado !== 'cancelada' && !!e.orden_id

/** Recuerda ids durante un rato (borrados recientes, tocados recientes) */
export class Recientes {
  private m = new Map<string, number>()
  private ms: number
  constructor(ms: number) {
    this.ms = ms
  }
  add(id: string, ahora = Date.now()) {
    this.m.set(id, ahora)
  }
  /** Ids vistos desde `desde` (o en los últimos `ms`) */
  conjunto(desde?: number, ahora = Date.now()): Set<string> {
    for (const [k, t] of this.m) if (ahora - t > this.ms) this.m.delete(k)
    return new Set([...this.m].filter(([, t]) => desde === undefined || t >= desde).map(([k]) => k))
  }
}
