// Estado único de la agenda (visitas/citas y tareas), compartido por la tabla, el calendario y el formulario.
// Lo que se cambia en un sitio se ve al momento en los demás porque todos leen de aquí.
// Solo se cargan los eventos del rango que se está viendo (más un margen) y las visitas futuras.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../data/api'
import { combinarTipos, TIPOS_BASE, type Evento, type EventoInput, type TipoCita } from '../lib/eventos'
import { addDias } from '../lib/fechas'
import { ordenesConVisitaFutura, proximasVisitas } from '../lib/porProgramar'
import type { Tarea, TareaInput } from '../lib/tareas'

export interface Agenda {
  eventos: Evento[]
  tareas: Tarea[]
  tipos: TipoCita[]
  tiposMap: ReadonlyMap<string, TipoCita>
  /** Próxima visita pendiente de cada orden */
  proximas: ReadonlyMap<string, Evento>
  /** Órdenes con alguna visita pendiente desde hoy */
  conVisita: ReadonlySet<string>
  /** false si las tablas aún no existen en la base de datos (migración sin aplicar) */
  disponible: boolean
  cargarRango(desde: string, hasta: string): Promise<void>
  cargarOrden(id: string): Promise<void>
  crearEvento(e: EventoInput): Promise<Evento | null>
  actualizarEvento(id: string, cambios: Partial<EventoInput>): Promise<Evento | null>
  eliminarEvento(id: string): Promise<boolean>
  crearTarea(t: TareaInput): Promise<Tarea | null>
  actualizarTarea(id: string, cambios: Partial<TareaInput>): Promise<Tarea | null>
  eliminarTarea(id: string): Promise<boolean>
  recargarTipos(): Promise<void>
  /** Quita de memoria lo de una orden borrada (la base de datos lo borra en cascada) */
  olvidarOrden(id: string): void
}

const vacia: Agenda = {
  eventos: [],
  tareas: [],
  tipos: [...TIPOS_BASE],
  tiposMap: new Map(TIPOS_BASE.map((t) => [t.id, t])),
  proximas: new Map(),
  conVisita: new Set(),
  disponible: false,
  cargarRango: async () => {},
  cargarOrden: async () => {},
  crearEvento: async () => null,
  actualizarEvento: async () => null,
  eliminarEvento: async () => false,
  crearTarea: async () => null,
  actualizarTarea: async () => null,
  eliminarTarea: async () => false,
  recargarTipos: async () => {},
  olvidarOrden: () => {},
}

export const AgendaCtx = createContext<Agenda>(vacia)
export const useAgenda = () => useContext(AgendaCtx)

/** Mete o actualiza elementos; si nada cambia, devuelve el MISMO mapa (evita repintar en bucle) */
const juntar = <T extends { id: string; updated_at?: string }>(m: Map<string, T>, lista: readonly T[]) => {
  const cambia = lista.some((x) => {
    const p = m.get(x.id)
    return !p || p.updated_at !== x.updated_at || p.updated_at === undefined
  })
  if (!cambia) return m
  const n = new Map(m)
  for (const x of lista) n.set(x.id, x)
  return n
}

/** Crea el estado de la agenda. Se usa una vez, en el panel principal. */
export function useAgendaEstado(hoy: string, avisar: (msg: string, err?: boolean) => void, tiposPlazo: readonly string[] = []): Agenda {
  const [eventos, setEventos] = useState<Map<string, Evento>>(new Map())
  const [tareas, setTareas] = useState<Map<string, Tarea>>(new Map())
  const [tiposFilas, setTiposFilas] = useState<TipoCita[]>([])
  const [disponible, setDisponible] = useState(true)
  const cargados = useRef(new Set<string>())
  const avisado = useRef(false)

  const fallo = useCallback(
    (error: string) => {
      if (/no está activada/.test(error)) {
        setDisponible(false)
        if (!avisado.current) console.warn('Agenda no disponible: falta aplicar la migración de la fase 2')
        avisado.current = true
        return
      }
      avisar(error, true)
    },
    [avisar],
  )

  const recargarTipos = useCallback(async () => {
    const r = await (await api()).listarTipos()
    if (r.error === null) setTiposFilas(r.data)
    else fallo('No se pudieron cargar los tipos de cita: ' + r.error)
  }, [fallo])

  // Al empezar: visitas futuras (para la tabla y «Por programar»), tipos y tareas de este mes y pendientes
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const b = await api()
      const [v, t] = await Promise.all([b.listarVisitasFuturas(hoy), b.listarTareas(addDias(hoy, -31), addDias(hoy, 62))])
      if (!vivo) return
      if (v.error !== null) return fallo(v.error)
      setDisponible(true)
      setEventos((m) => juntar(m, v.data))
      if (t.error === null) setTareas((m) => juntar(m, t.data))
      else fallo('No se pudieron cargar las tareas: ' + t.error)
      recargarTipos()
    })()
    return () => {
      vivo = false
    }
  }, [hoy, fallo, recargarTipos])

  // Reglas de plazo que cuentan desde una cita: hacen falta TODAS las citas de esos tipos
  const clavesTipos = [...tiposPlazo].sort().join(',')
  useEffect(() => {
    if (!clavesTipos) return
    let vivo = true
    ;(async () => {
      const r = await (await api()).listarEventosDeTipos(clavesTipos.split(','))
      if (!vivo) return
      if (r.error === null) setEventos((m) => juntar(m, r.data))
      else fallo('No se pudieron cargar las citas de los plazos: ' + r.error)
    })()
    return () => {
      vivo = false
    }
  }, [clavesTipos, fallo])

  const cargarRango = useCallback(
    async (desde: string, hasta: string) => {
      // Se carga por meses enteros (con margen) y cada mes una sola vez
      const ini = addDias(desde, -7).slice(0, 7) + '-01'
      const fin = addDias(hasta, 7)
      const clave = `${ini}|${fin.slice(0, 7)}`
      if (cargados.current.has(clave)) return
      cargados.current.add(clave)
      const b = await api()
      const [e, t] = await Promise.all([b.listarEventos(ini, fin), b.listarTareas(ini, fin)])
      if (e.error !== null) {
        cargados.current.delete(clave)
        return fallo(e.error)
      }
      setEventos((m) => juntar(m, e.data))
      if (t.error === null) setTareas((m) => juntar(m, t.data))
      else fallo('No se pudieron cargar las tareas: ' + t.error)
    },
    [fallo],
  )

  const cargarOrden = useCallback(
    async (id: string) => {
      const r = await (await api()).listarAgendaOrden(id)
      if (r.error !== null) return fallo(r.error)
      setEventos((m) => juntar(m, r.data.eventos))
      setTareas((m) => juntar(m, r.data.tareas))
    },
    [fallo],
  )

  const crearEvento = useCallback(
    async (e: EventoInput) => {
      const r = await (await api()).crearEvento(e)
      if (r.error !== null) {
        fallo('No se pudo guardar: ' + r.error)
        return null
      }
      setEventos((m) => juntar(m, [r.data]))
      return r.data
    },
    [fallo],
  )
  const actualizarEvento = useCallback(
    async (id: string, cambios: Partial<EventoInput>) => {
      const r = await (await api()).actualizarEvento(id, cambios)
      if (r.error !== null) {
        fallo('No se pudo guardar: ' + r.error)
        return null
      }
      setEventos((m) => juntar(m, [r.data]))
      return r.data
    },
    [fallo],
  )
  const eliminarEvento = useCallback(
    async (id: string) => {
      const err = await (await api()).eliminarEvento(id)
      if (err) {
        fallo('No se pudo eliminar: ' + err)
        return false
      }
      // Las excepciones de una serie se borran con ella (cascada)
      setEventos((m) => new Map([...m].filter(([k, v]) => k !== id && v.serie_id !== id)))
      return true
    },
    [fallo],
  )
  const crearTarea = useCallback(
    async (t: TareaInput) => {
      const r = await (await api()).crearTarea(t)
      if (r.error !== null) {
        fallo('No se pudo guardar: ' + r.error)
        return null
      }
      setTareas((m) => juntar(m, [r.data]))
      return r.data
    },
    [fallo],
  )
  const actualizarTarea = useCallback(
    async (id: string, cambios: Partial<TareaInput>) => {
      const r = await (await api()).actualizarTarea(id, cambios)
      if (r.error !== null) {
        fallo('No se pudo guardar: ' + r.error)
        return null
      }
      setTareas((m) => juntar(m, [r.data]))
      return r.data
    },
    [fallo],
  )
  const eliminarTarea = useCallback(
    async (id: string) => {
      const err = await (await api()).eliminarTarea(id)
      if (err) {
        fallo('No se pudo eliminar: ' + err)
        return false
      }
      setTareas((m) => new Map([...m].filter(([k]) => k !== id)))
      return true
    },
    [fallo],
  )
  const olvidarOrden = useCallback((id: string) => {
    setEventos((m) => new Map([...m].filter(([, v]) => v.orden_id !== id)))
    setTareas((m) => new Map([...m].filter(([, v]) => v.orden_id !== id)))
  }, [])

  const listaEventos = useMemo(() => [...eventos.values()], [eventos])
  const listaTareas = useMemo(() => [...tareas.values()], [tareas])
  const tipos = useMemo(() => combinarTipos(tiposFilas), [tiposFilas])
  const tiposMap = useMemo(() => new Map(tipos.map((t) => [t.id, t])), [tipos])
  const proximas = useMemo(() => proximasVisitas(listaEventos, hoy), [listaEventos, hoy])
  const conVisita = useMemo(() => ordenesConVisitaFutura(listaEventos, hoy), [listaEventos, hoy])

  return useMemo(
    () => ({
      eventos: listaEventos,
      tareas: listaTareas,
      tipos,
      tiposMap,
      proximas,
      conVisita,
      disponible,
      cargarRango,
      cargarOrden,
      crearEvento,
      actualizarEvento,
      eliminarEvento,
      crearTarea,
      actualizarTarea,
      eliminarTarea,
      recargarTipos,
      olvidarOrden,
    }),
    [listaEventos, listaTareas, tipos, tiposMap, proximas, conVisita, disponible, cargarRango, cargarOrden, crearEvento, actualizarEvento, eliminarEvento, crearTarea, actualizarTarea, eliminarTarea, recargarTipos, olvidarOrden],
  )
}
