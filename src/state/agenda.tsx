// Estado único de la agenda (visitas/citas y tareas), compartido por la tabla, el calendario y el formulario.
// Lo que se cambia en un sitio se ve al momento en los demás porque todos leen de aquí.
// Solo se cargan los eventos del rango que se está viendo (más un margen) y las visitas futuras.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, type Resultado } from '../data/api'
import { useAlVolver } from '../hooks'
import { eventoDeTipos, eventoEnRango, juntar, Recientes, sustituir, tareaEnRango, visitaFutura } from '../lib/juntar'
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

/** Cuánto se recuerda lo borrado o cambiado aquí (para no hacer caso a respuestas tardías) */
const RECUERDO_MS = 5 * 60_000

/** Crea el estado de la agenda. Se usa una vez, en el panel principal. */
export function useAgendaEstado(hoy: string, avisar: (msg: string, err?: boolean) => void, tiposPlazo: readonly string[] = []): Agenda {
  const [eventos, setEventos] = useState<Map<string, Evento>>(new Map())
  const [tareas, setTareas] = useState<Map<string, Tarea>>(new Map())
  const [tiposFilas, setTiposFilas] = useState<TipoCita[]>([])
  const [disponible, setDisponible] = useState(true)
  const cargados = useRef(new Set<string>())
  const avisado = useRef(false)
  // Borrados y cambiados aquí hace poco (lo mezcla lib/juntar.ts) y último rango pedido por el calendario
  const borrados = useRef(new Recientes(RECUERDO_MS))
  const tocados = useRef(new Recientes(RECUERDO_MS))
  const ultimoRango = useRef<{ desde: string; hasta: string } | null>(null)
  // Sube al volver a la pestaña: vuelve a pedir visitas futuras, tareas y citas de plazos
  const [recarga, setRecarga] = useState(0)

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
  }, [])

  // Al empezar: visitas futuras (para la tabla y «Por programar»), tipos y tareas de este mes y pendientes
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const inicio = Date.now()
      const b = await api()
      const desde = addDias(hoy, -31)
      const hasta = addDias(hoy, 62)
      const [v, t] = await Promise.all([b.listarVisitasFuturas(hoy), b.listarTareas(desde, hasta)])
      if (!vivo) return
      if (v.error !== null) return fallo(v.error)
      setDisponible(true)
      const bor = borrados.current.conjunto()
      const toc = tocados.current.conjunto(inicio)
      setEventos((m) => sustituir(m, v.data, visitaFutura(hoy), bor, toc))
      if (t.error === null) setTareas((m) => sustituir(m, t.data, tareaEnRango(desde, hasta), bor, toc))
      recargarTipos()
    })().catch(() => vivo && fallo('No se pudo cargar la agenda: no hay conexión con el servidor.'))
    return () => {
      vivo = false
    }
  }, [hoy, fallo, recargarTipos, recarga])

  // Reglas de plazo que cuentan desde una cita: hacen falta TODAS las citas de esos tipos
  const clavesTipos = [...tiposPlazo].sort().join(',')
  useEffect(() => {
    if (!clavesTipos) return
    ;(async () => {
      const inicio = Date.now()
      const lista = clavesTipos.split(',')
      const r = await (await api()).listarEventosDeTipos(lista)
      if (r.error !== null) return
      const bor = borrados.current.conjunto()
      const toc = tocados.current.conjunto(inicio)
      setEventos((m) => sustituir(m, r.data, eventoDeTipos(lista), bor, toc))
    })().catch(() => {})
  }, [clavesTipos, recarga])

  const cargarRango = useCallback(
    async (desde: string, hasta: string) => {
      // Se carga por meses enteros (con margen) y cada mes una sola vez
      const ini = addDias(desde, -7).slice(0, 7) + '-01'
      const fin = addDias(hasta, 7)
      const clave = `${ini}|${fin.slice(0, 7)}`
      ultimoRango.current = { desde, hasta }
      if (cargados.current.has(clave)) return
      cargados.current.add(clave)
      const inicio = Date.now()
      try {
        const b = await api()
        const [e, t] = await Promise.all([b.listarEventos(ini, fin), b.listarTareas(ini, fin)])
        if (e.error !== null) {
          cargados.current.delete(clave)
          return fallo(e.error)
        }
        // Lo de este rango se SUSTITUYE: lo borrado en otro sitio desaparece también aquí
        const bor = borrados.current.conjunto()
        const toc = tocados.current.conjunto(inicio)
        setEventos((m) => sustituir(m, e.data, eventoEnRango(ini, fin), bor, toc))
        if (t.error === null) setTareas((m) => sustituir(m, t.data, tareaEnRango(ini, fin), bor, toc))
      } catch {
        cargados.current.delete(clave)
        fallo('No se pudo cargar el calendario: no hay conexión con el servidor.')
      }
    },
    [fallo],
  )

  const cargarOrden = useCallback(
    async (id: string) => {
      const inicio = Date.now()
      let r: Resultado<{ eventos: Evento[]; tareas: Tarea[] }>
      try {
        r = await (await api()).listarAgendaOrden(id)
      } catch {
        return fallo('No se pudo cargar la agenda de la orden: no hay conexión con el servidor.')
      }
      if (r.error !== null) return fallo(r.error)
      const { eventos: ev, tareas: ta } = r.data
      const bor = borrados.current.conjunto()
      const toc = tocados.current.conjunto(inicio)
      setEventos((m) => sustituir(m, ev, (e) => e.orden_id === id, bor, toc))
      setTareas((m) => sustituir(m, ta, (t) => t.orden_id === id, bor, toc))
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
      tocados.current.add(r.data.id)
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
      tocados.current.add(r.data.id)
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
      borrados.current.add(id)
      setEventos((m) => {
        for (const v of m.values()) if (v.serie_id === id) borrados.current.add(v.id)
        return new Map([...m].filter(([k, v]) => k !== id && v.serie_id !== id))
      })
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
      tocados.current.add(r.data.id)
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
      tocados.current.add(r.data.id)
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
      borrados.current.add(id)
      setTareas((m) => new Map([...m].filter(([k]) => k !== id)))
      return true
    },
    [fallo],
  )
  const olvidarOrden = useCallback((id: string) => {
    const olvida = <T extends { id: string; orden_id: string | null }>(m: Map<string, T>) => {
      for (const v of m.values()) if (v.orden_id === id) borrados.current.add(v.id)
      return new Map([...m].filter(([, v]) => v.orden_id !== id))
    }
    setEventos(olvida)
    setTareas(olvida)
  }, [])

  // Al volver a la pestaña (si hace más de 30 s de la última vez): se vuelve a pedir todo lo que se ve,
  // por si se cambió algo en otro dispositivo o desde ChatGPT
  useAlVolver(
    useCallback(() => {
      cargados.current.clear()
      setRecarga((n) => n + 1)
      const r = ultimoRango.current
      if (r) cargarRango(r.desde, r.hasta)
    }, [cargarRango]),
  )

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
