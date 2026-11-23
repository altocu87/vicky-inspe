// «Deshacer» un borrado: vuelve a crear visitas/citas (con las excepciones de sus series) y tareas,
// contando lo que no se ha podido recuperar para avisar con honestidad (auditoría #11).
// Se crean por grupos (una petición por grupo con Backend.crearEventos/crearTareas):
//   1) citas normales y series, 2) excepciones de esas series (apuntando al id NUEVO de su serie).
import type { Evento, EventoInput } from './eventos'
import type { Tarea, TareaInput } from './tareas'

/**
 * Crea una lista y devuelve, en la MISMA posición, lo creado o null si no se pudo.
 * (Una inserción masiva que falla entera devuelve todo null.)
 */
export type CrearVarios<I, T> = (lista: I[]) => Promise<(T | null)[]>

const sinIds = <T extends { id: string; created_at?: string; updated_at?: string }>(x: T): Omit<T, 'id' | 'created_at' | 'updated_at'> => {
  const { id, created_at, updated_at, ...resto } = x
  void id
  void created_at
  void updated_at
  return resto
}

/** Llama a `crear` protegiendo de errores de red: si lanza, todo cuenta como fallo */
async function seguro<I, T>(crear: CrearVarios<I, T>, lista: I[]): Promise<(T | null)[]> {
  if (!lista.length) return []
  try {
    const r = await crear(lista)
    return lista.map((_, i) => r[i] ?? null)
  } catch {
    return lista.map(() => null)
  }
}

/** Vuelve a crear eventos (series con sus excepciones). `cambios` se aplica a todos. Devuelve cuántos fallaron. */
export async function restaurarEventos(lista: readonly Evento[], crear: CrearVarios<EventoInput, Evento>, cambios: Partial<EventoInput> = {}): Promise<number> {
  const enLista = new Set(lista.map((e) => e.id))
  // Las excepciones cuya serie no está en la lista (serie que sigue existiendo) van en el primer grupo, tal cual
  const primeros = lista.filter((x) => !x.serie_id || !enLista.has(x.serie_id))
  const r1 = await seguro(crear, primeros.map((e) => ({ ...sinIds(e), ...cambios })))
  const ids = new Map<string, string>()
  primeros.forEach((e, i) => r1[i] && ids.set(e.id, r1[i]!.id))
  let fallos = r1.filter((x) => !x).length
  const excepciones = lista.filter((x) => x.serie_id && enLista.has(x.serie_id))
  const conSerie = excepciones.filter((e) => ids.has(e.serie_id!))
  fallos += excepciones.length - conSerie.length
  const r2 = await seguro(crear, conSerie.map((e) => ({ ...sinIds(e), ...cambios, serie_id: ids.get(e.serie_id!)! })))
  return fallos + r2.filter((x) => !x).length
}

/** Vuelve a crear tareas; devuelve cuántas fallaron */
export async function restaurarTareas(lista: readonly Tarea[], crear: CrearVarios<TareaInput, Tarea>, cambios: Partial<TareaInput> = {}): Promise<number> {
  const r = await seguro(crear, lista.map((t) => ({ ...sinIds(t), ...cambios })))
  return r.filter((x) => !x).length
}

/** Adapta una inserción masiva del Backend (todo o nada) a CrearVarios */
export const enBloque =
  <I, T>(fn: (l: I[]) => Promise<{ data: T[]; error: null } | { data: null; error: string }>, alFallar?: (error: string) => void): CrearVarios<I, T> =>
  async (l) => {
    const r = await fn(l)
    if (r.error !== null) {
      alFallar?.(r.error)
      return l.map(() => null)
    }
    return r.data
  }

/** Adapta una creación de uno en uno (p. ej. la de la agenda, que ya avisa si falla) a CrearVarios */
export const deUnoEnUno =
  <I, T>(fn: (x: I) => Promise<T | null>): CrearVarios<I, T> =>
  async (l) => {
    const out: (T | null)[] = []
    for (const x of l) out.push(await fn(x).catch(() => null))
    return out
  }

/** «3 visitas o tareas» / «1 visita o tarea» */
export const textoFallos = (n: number) => (n === 1 ? '1 visita o tarea no se pudo recuperar' : `${n} visitas o tareas no se pudieron recuperar`)
