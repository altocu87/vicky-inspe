// «Deshacer» un borrado: vuelve a crear visitas/citas (con las excepciones de sus series) y tareas,
// contando lo que no se ha podido recuperar para avisar con honestidad (auditoría #11).
import type { Evento, EventoInput } from './eventos'
import type { Tarea, TareaInput } from './tareas'

const sinIds = <T extends { id: string; created_at?: string; updated_at?: string }>(x: T): Omit<T, 'id' | 'created_at' | 'updated_at'> => {
  const { id, created_at, updated_at, ...resto } = x
  void id
  void created_at
  void updated_at
  return resto
}

/**
 * Vuelve a crear eventos. Primero los normales y las series; después las excepciones de cada serie,
 * apuntando al id NUEVO de su serie (si su serie no se pudo crear, cuentan como fallo).
 * `cambios` se aplica a todos (p. ej. el id nuevo de la orden). Devuelve cuántos fallaron.
 */
export async function restaurarEventos(
  lista: readonly Evento[],
  crear: (e: EventoInput) => Promise<Evento | null>,
  cambios: Partial<EventoInput> = {},
): Promise<number> {
  const ids = new Map<string, string>()
  let fallos = 0
  const enLista = new Set(lista.map((e) => e.id))
  // Las excepciones cuya serie no está en la lista (serie que sigue existiendo) se crean tal cual
  for (const e of lista.filter((x) => !x.serie_id || !enLista.has(x.serie_id))) {
    try {
      const n = await crear({ ...sinIds(e), ...cambios })
      if (n) ids.set(e.id, n.id)
      else fallos++
    } catch {
      fallos++
    }
  }
  for (const e of lista.filter((x) => x.serie_id && enLista.has(x.serie_id))) {
    const serie = ids.get(e.serie_id!)
    if (!serie) {
      fallos++
      continue
    }
    try {
      if (!(await crear({ ...sinIds(e), ...cambios, serie_id: serie }))) fallos++
    } catch {
      fallos++
    }
  }
  return fallos
}

/** Vuelve a crear tareas; devuelve cuántas fallaron */
export async function restaurarTareas(lista: readonly Tarea[], crear: (t: TareaInput) => Promise<Tarea | null>, cambios: Partial<TareaInput> = {}): Promise<number> {
  let fallos = 0
  for (const t of lista) {
    try {
      if (!(await crear({ ...sinIds(t), ...cambios }))) fallos++
    } catch {
      fallos++
    }
  }
  return fallos
}

/** «3 visitas o tareas» / «1 visita o tarea» */
export const textoFallos = (n: number) => (n === 1 ? '1 visita o tarea no se pudo recuperar' : `${n} visitas o tareas no se pudieron recuperar`)
