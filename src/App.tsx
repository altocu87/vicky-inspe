import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { api, type Resultado } from './data/api'
import { PlazosCtx, RepetidosCtx, useAlVolver, useEstable, useMobile, usePref } from './hooks'
import { celdaCsv } from './lib/csv'
import { addDias, hoyIso } from './lib/fechas'
import { FESTIVOS_ALBACETE } from './lib/festivosAlbacete'
import { mapaFestivos, type Festivo } from './lib/habiles'
import { contarEstados, nombreFiltro, pasaFiltros, repeticionesDeNumero, type Filtro } from './lib/filtros'
import { ESTADOS, diasMinimos, fmtCorta, type Orden } from './lib/ordenes'
import { plazoActivoDe, proximoPlazo, type ContextoPlazos } from './lib/plazos/motor'
import { combinarReglas, type ReglaFila } from './lib/plazos/reglas'
import { leerRuta, type Ruta } from './lib/ruta'
import { Recientes, sustituir } from './lib/juntar'
import { enBloque, restaurarEventos, restaurarTareas, textoFallos } from './lib/restaurar'
import { irA } from './nav'
import { Login } from './components/Login'
import { Logo } from './components/Logo'
import { OrdenForm } from './components/OrdenForm'
import { ConfirmDelete } from './components/ConfirmDelete'
import { ListaMovil, type Sort, type SortKey } from './components/TablaOrdenes'
import { COLUMNAS } from './components/columnas'
import { FichasOrdenes } from './components/FichasOrdenes'
import { GestorAgenda } from './components/agenda/Gestor'
import { AgendaCtx, useAgendaEstado } from './state/agenda'
import type { Evento } from './lib/eventos'
import { textoHora } from './lib/eventos'

// El calendario (y la librería de repeticiones) se descarga solo al abrirlo
const Calendario = lazy(() => import('./components/calendario/Calendario').then((m) => ({ default: m.Calendario })))
// Pantallas que no se ven al entrar: se descargan la primera vez que se abren
const Ajustes = lazy(() => import('./components/Ajustes').then((m) => ({ default: m.Ajustes })))
const Estadisticas = lazy(() => import('./components/Estadisticas').then((m) => ({ default: m.Estadisticas })))
const Tutorial = lazy(() => import('./components/Tutorial').then((m) => ({ default: m.Tutorial })))
const CARGANDO = (
  <div className="loader">
    <span />
  </div>
)

type Snack = { msg: string; err?: boolean; action?: { label: string; fn: () => void } }

const SORTS_MOVIL: { id: string; label: string; sort: Sort }[] = [
  { id: 'rec', label: 'Más recientes', sort: { key: 'fecha_orden', dir: 'desc' } },
  { id: 'urg', label: 'Más urgentes', sort: { key: 'urgencia', dir: 'asc' } },
  { id: 'prox', label: 'Próximo plazo', sort: { key: 'prox', dir: 'asc' } },
  { id: 'vis', label: 'Próxima visita', sort: { key: 'visita_prox', dir: 'asc' } },
  { id: 'ant', label: 'Más antiguas', sort: { key: 'fecha_orden', dir: 'asc' } },
  { id: 'emp', label: 'Empresa (A-Z)', sort: { key: 'empresa', dir: 'asc' } },
  { id: 'num', label: 'Nº orden', sort: { key: 'num_orden', dir: 'asc' } },
]

function valorOrden(o: Orden, k: SortKey, ctx: ContextoPlazos, prox: ReadonlyMap<string, Evento>): string | number | null {
  switch (k) {
    case 'visita_prox':
      return prox.get(o.id)?.fecha ?? null
    case 'urgencia':
      return diasMinimos(o, ctx)
    case 'lim9':
      return plazoActivoDe(o, 'lim9', ctx)?.fecha ?? null
    case 'sig':
      return plazoActivoDe(o, 'sig', ctx)?.fecha ?? null
    case 'prox':
      return o.estado === 'FINALIZADA' ? null : (proximoPlazo(o, ctx)?.fecha ?? null)
    case 'estado':
      return ESTADOS.indexOf(o.estado)
    default:
      return (o[k] as string | null) ?? null
  }
}

function exportarCsv(rows: Orden[], ctx: ContextoPlazos, prox: ReadonlyMap<string, Evento>) {
  const cols = COLUMNAS
  const val = (o: Orden, k: SortKey): string => {
    if (k === 'visita_prox') {
      const v = prox.get(o.id)
      return v ? `${fmtCorta(v.fecha)}${v.todo_el_dia ? '' : ' ' + textoHora(v)}` : ''
    }
    if (k === 'lim9' || k === 'sig') {
      const p = plazoActivoDe(o, k, ctx)
      return p ? fmtCorta(p.fecha) : ''
    }
    if (k === 'prox') {
      const p = o.estado === 'FINALIZADA' ? null : proximoPlazo(o, ctx)
      return p ? `${fmtCorta(p.fecha)} (${p.regla.nombre})` : ''
    }
    if (k.startsWith('fecha_') && k !== 'fecha_visita') return o[k as keyof Orden] ? fmtCorta(o[k as keyof Orden] as string) : ''
    return (o[k as keyof Orden] as string | null) ?? ''
  }
  // Evita que Excel interprete un texto como fórmula (inyección CSV): ver lib/csv
  const esc = celdaCsv
  const lines = [cols.map((c) => esc(c.label)).join(';'), ...rows.map((o) => cols.map((c) => esc(val(o, c.key))).join(';'))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ordenes-${hoyIso()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

function SortMenu({ actual, onPick, conTexto }: { actual: string; onPick: (id: string) => void; conTexto?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('pointerdown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open])
  const act = SORTS_MOVIL.find((s) => s.id === actual)
  return (
    <div className="menu-wrap" ref={ref}>
      {conTexto ? (
        <button className="btn outlined sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
          <span className="icon">swap_vert</span>
          {act?.label ?? 'Ordenar'}
        </button>
      ) : (
        <button className="icon-btn tonal" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" aria-label="Ordenar" title="Ordenar">
          <span className="icon">swap_vert</span>
        </button>
      )}
      {open && (
        <div className="menu" role="menu">
          <span className="menu-title label-m muted">Ordenar por</span>
          {SORTS_MOVIL.map((s) => (
            <button
              key={s.id}
              role="menuitemradio"
              aria-checked={s.id === actual}
              className={`menu-item${s.id === actual ? ' on' : ''}`}
              onClick={() => {
                onPick(s.id)
                setOpen(false)
              }}
            >
              <span className="icon">{s.id === actual ? 'check' : ''}</span>
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  // Aviso para la pantalla de entrada si al cerrar sesión algo no fue del todo bien
  const [avisoSalida, setAvisoSalida] = useState<string | undefined>(undefined)

  useEffect(() => {
    let quitar = () => {}
    let vivo = true
    api()
      .then(async (b) => {
        const s = await b.sesion()
        if (!vivo) return
        setSession(s)
        quitar = b.alCambiarSesion(setSession)
      })
      // Sin conexión: se enseña el inicio de sesión (que avisará al intentar entrar) en vez de cargar sin fin
      .catch(() => vivo && setSession(null))
    return () => {
      vivo = false
      quitar()
    }
  }, [])

  if (session === undefined)
    return (
      <div className="loader">
        <span />
      </div>
    )
  if (!session) return <Login aviso={avisoSalida} />
  return <Panel email={session.user.email ?? ''} onAvisoSalida={setAvisoSalida} />
}

function Panel({ email, onAvisoSalida }: { email: string; onAvisoSalida: (aviso: string) => void }) {
  const mobile = useMobile()
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  // Nº repetidos: qué número de repetición es cada orden (1.ª, 2.ª…)
  const repetidos = useMemo(() => repeticionesDeNumero(ordenes), [ordenes])
  const [loading, setLoading] = useState(true)
  // Si falla la carga de las órdenes, se dice claramente (no se confunde con «no hay órdenes»)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [festivos, setFestivos] = useState<Festivo[]>([])
  /** true si no se pudieron leer los festivos guardados y se están usando los de serie */
  const [festivosDeSerie, setFestivosDeSerie] = useState(false)
  const [reglasFilas, setReglasFilas] = useState<ReglaFila[]>([])
  // Filtros: UN solo estado para tabla, tarjetas y calendario
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [ocultarFin, setOcultarFin] = usePref('ocultarFin', true)
  const [sort, setSort] = usePref<Sort>('sort', { key: 'fecha_orden', dir: 'desc' })
  const [editing, setEditing] = useState<Orden | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Orden | null>(null)
  const [snack, setSnack] = useState<Snack | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [tutorial, setTutorial] = useState(false)
  const [ruta, setRuta] = useState<Ruta>(() => leerRuta(window.location.hash))
  const pantalla = ruta.pantalla

  useEffect(() => {
    const h = () => {
      setRuta(leerRuta(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('popstate', h)
    window.addEventListener('hashchange', h)
    return () => {
      window.removeEventListener('popstate', h)
      window.removeEventListener('hashchange', h)
    }
  }, [])
  function volver() {
    if (window.history.length > 1 && window.location.hash) window.history.back()
    else irA({ pantalla: 'lista' }, true)
  }
  const snackTimer = useRef<number | undefined>(undefined)

  const showSnack = useCallback((s: Snack) => {
    window.clearTimeout(snackTimer.current)
    setSnack(s)
    snackTimer.current = window.setTimeout(() => setSnack(null), s.action ? 7000 : 4000)
  }, [])

  // Órdenes borradas o cambiadas aquí hace poco: una respuesta tardía no las resucita ni las pisa
  const ordBorradas = useRef(new Recientes(5 * 60_000))
  const ordTocadas = useRef(new Recientes(5 * 60_000))
  const cargar = useCallback(async () => {
    const inicio = Date.now()
    try {
      const { data, error } = await (await api()).listarOrdenes()
      if (error !== null) setErrorCarga(error)
      else {
        const bor = ordBorradas.current.conjunto()
        const toc = ordTocadas.current.conjunto(inicio)
        // Lista completa: sustituye todo, quedándose con la versión más reciente de cada orden
        setOrdenes((prev) => [...sustituir(new Map(prev.map((o) => [o.id, o])), data, () => true, bor, toc).values()])
        setErrorCarga(null)
      }
    } catch {
      setErrorCarga('No hay conexión con el servidor.')
    } finally {
      setLoading(false)
    }
  }, [])
  function reintentar() {
    setLoading(true)
    setErrorCarga(null)
    cargar()
  }

  // Festivos (del año pasado al siguiente) y reglas de plazo guardadas en Ajustes
  const cargarConfig = useCallback(async () => {
    try {
      const b = await api()
      const hoy = hoyIso()
      const anio = Number(hoy.slice(0, 4))
      const [f, r] = await Promise.all([b.listarFestivos(`${anio - 1}-01-01`, `${anio + 2}-12-31`), b.listarReglas()])
      // Si aún no existen las tablas o falla la red, se usan los festivos incluidos en la app
      setFestivos(f.error === null ? f.data : [...FESTIVOS_ALBACETE])
      setFestivosDeSerie(f.error !== null)
      if (f.error !== null) showSnack({ msg: 'No se pudieron cargar los festivos; se usan los de serie: ' + f.error, err: true })
      setReglasFilas(r.error === null ? r.data : [])
      if (f.error !== null || r.error !== null) console.warn('Configuración del calendario no disponible; se usan los valores por defecto')
    } catch {
      setFestivos([...FESTIVOS_ALBACETE])
      setFestivosDeSerie(true)
      showSnack({ msg: 'Sin conexión: se usan los festivos y plazos de serie.', err: true })
    }
  }, [showSnack])

  useEffect(() => {
    cargar()
    cargarConfig()
  }, [cargar, cargarConfig])
  // Al volver a la pestaña (si hace más de 30 s), se vuelven a pedir las órdenes (la agenda hace lo mismo)
  useAlVolver(cargar)

  // «Hoy» se recalcula al volver a la app (por si se quedó abierta de un día para otro)
  const [hoy, setHoy] = useState(hoyIso)
  useEffect(() => {
    const h = () => document.visibilityState === 'visible' && setHoy(hoyIso())
    document.addEventListener('visibilitychange', h)
    const t = window.setTimeout(() => setHoy(hoyIso()), Math.max(1000, new Date(addDias(hoy, 1) + 'T00:00:05').getTime() - Date.now()))
    return () => {
      document.removeEventListener('visibilitychange', h)
      window.clearTimeout(t)
    }
  }, [hoy])

  const reglas = useMemo(() => combinarReglas(reglasFilas), [reglasFilas])
  // Agenda (visitas, citas y tareas): un solo estado para la tabla, el calendario y el formulario
  const avisar = useCallback(
    (msg: string, err?: boolean, deshacer?: () => void) => showSnack({ msg, err, action: deshacer ? { label: 'Deshacer', fn: deshacer } : undefined }),
    [showSnack],
  )
  const tiposPlazo = useMemo(() => reglas.filter((r) => r.activa && 'evento' in r.partida).map((r) => ('evento' in r.partida ? r.partida.evento : '')), [reglas])
  const agenda = useAgendaEstado(hoy, avisar, tiposPlazo)
  // Las reglas que cuentan desde una cita usan las citas no canceladas de cada orden
  const eventosPlazosNuevos = useMemo(
    () =>
      tiposPlazo.length
        ? agenda.eventos.filter((e) => e.orden_id && e.estado !== 'cancelada' && tiposPlazo.includes(e.tipo)).map((e) => ({ orden_id: e.orden_id!, tipo: e.tipo, fecha: e.fecha }))
        : undefined,
    [agenda.eventos, tiposPlazo],
  )
  // Solo cambia (y con él el contexto y todos los plazos) si cambian las citas que cuentan
  const eventosPlazos = useEstable(eventosPlazosNuevos, eventosPlazosNuevos ? eventosPlazosNuevos.map((e) => `${e.orden_id}|${e.tipo}|${e.fecha}`).join(',') : '-')
  const ctx = useMemo<ContextoPlazos>(() => ({ hoy, reglas, festivos: mapaFestivos(festivos), eventos: eventosPlazos }), [hoy, reglas, festivos, eventosPlazos])

  const stats = useMemo(() => contarEstados(ordenes, ctx), [ordenes, ctx])

  // La búsqueda filtra con un valor «diferido»: el cuadro de texto responde al instante y la lista se pone al día después
  const qDiferida = useDeferredValue(q)
  const visibles = useMemo(() => {
    const f = { q: qDiferida, filtro, ocultarFin }
    const list = ordenes.filter((o) => pasaFiltros(o, f, ctx))
    const m = sort.dir === 'asc' ? 1 : -1
    // La clave de cada orden se calcula una vez antes de ordenar (no dentro del comparador)
    const clave = new Map(list.map((o) => [o, valorOrden(o, sort.key, ctx, agenda.proximas)]))
    return list.sort((a, b) => {
      const va = clave.get(a)!
      const vb = clave.get(b)!
      if (va === vb) return (b.fecha_orden ?? '').localeCompare(a.fecha_orden ?? '')
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * m
    })
  }, [ordenes, qDiferida, filtro, ocultarFin, sort, ctx, agenda.proximas])
  const filtros = useMemo(() => ({ q: qDiferida, filtro, ocultarFin }), [qDiferida, filtro, ocultarFin])

  function elegirFiltro(f: Filtro) {
    const nuevo = filtro === f ? 'todos' : f
    setFiltro(nuevo)
    if (nuevo === 'FINALIZADA') setOcultarFin(false)
  }
  function toggleFin() {
    const v = !ocultarFin
    setOcultarFin(v)
    if (v && filtro === 'FINALIZADA') setFiltro('todos')
    if (mobile) showSnack({ msg: v ? 'Finalizadas ocultas' : 'Mostrando también las finalizadas' })
  }

  function guardada(o: Orden, nueva: boolean) {
    setEditing(null)
    ordTocadas.current.add(o.id)
    setOrdenes((prev) => (nueva ? [o, ...prev] : prev.map((x) => (x.id === o.id ? o : x))))
    showSnack({ msg: nueva ? 'Orden creada' : 'Cambios guardados' })
  }

  async function eliminar(o: Orden) {
    setDeleting(null)
    try {
      await eliminarOrden(o)
    } catch {
      showSnack({ msg: 'No se pudo completar: no hay conexión con el servidor. Comprueba la lista y vuelve a intentarlo.', err: true })
    }
  }
  async function eliminarOrden(o: Orden) {
    const b = await api()
    // Sus visitas y tareas se borran con ella (en cascada): se copian ANTES para poder deshacer.
    // Si la copia falla, no se borra (si no, «Deshacer» no podría recuperarlas).
    const suyas = await b.listarAgendaOrden(o.id)
    if (suyas.error !== null && agenda.disponible) return showSnack({ msg: 'No se ha eliminado: no se pudo hacer copia de sus visitas y tareas. Inténtalo de nuevo.', err: true })
    const err = await b.eliminarOrden(o.id)
    if (err) return showSnack({ msg: 'No se pudo eliminar: ' + err, err: true })
    ordBorradas.current.add(o.id)
    setOrdenes((prev) => prev.filter((x) => x.id !== o.id))
    agenda.olvidarOrden(o.id)
    showSnack({
      msg: 'Orden eliminada',
      action: {
        label: 'Deshacer',
        fn: () =>
          restaurar().catch(() => showSnack({ msg: 'No se pudo restaurar del todo: no hay conexión con el servidor. Revisa la orden y su agenda.', err: true })),
      },
    })
    async function restaurar() {
      // Se recrea con el MISMO id (los enlaces a la orden siguen valiendo)
      const { updated_at, ...rest } = o
      void updated_at
      const { data, error } = await b.crearOrden(rest)
      if (error !== null) return showSnack({ msg: 'No se pudo restaurar: ' + error, err: true })
      ordBorradas.current.quitar(data.id)
      ordTocadas.current.add(data.id)
      setOrdenes((prev) => [data, ...prev])
      let fallos = 0
      if (suyas.error === null) {
        // Cada grupo en una sola petición (inserción masiva); luego se recarga la agenda de la orden
        fallos += await restaurarEventos(suyas.data.eventos, enBloque((l) => b.crearEventos(l)), { orden_id: data.id })
        fallos += await restaurarTareas(suyas.data.tareas, enBloque((l) => b.crearTareas(l)), { orden_id: data.id })
        await agenda.cargarOrden(data.id)
      }
      showSnack(
        fallos
          ? { msg: `Orden restaurada, pero ${textoFallos(fallos)}. El historial de cambios no se recupera.`, err: true }
          : { msg: 'Orden restaurada (sin su historial de cambios)' },
      )
    }
  }

  const statCards: { k: Filtro; label: string; n: number; icon: string; cls?: string }[] = [
    { k: 'EN CURSO', label: 'En curso', n: stats['EN CURSO'], icon: 'progress_activity', cls: 's-curso' },
    { k: 'PTE ENTREGA', label: 'Pte. entrega', n: stats['PTE ENTREGA'], icon: 'hourglass_top', cls: 's-pte' },
    { k: 'DEVUELTA', label: 'Devueltas', n: stats.DEVUELTA, icon: 'assignment_return', cls: 's-dev' },
    { k: 'urgentes', label: 'Menos de 30 días', n: stats.urgentes, icon: 'warning', cls: 's-urg' },
  ]

  const sortActual = SORTS_MOVIL.find((s) => s.sort.key === sort.key && s.sort.dir === sort.dir)?.id ?? ''
  const enCal = pantalla === 'calendario'
  const salir = async () => {
    const aviso = await (await api()).salir()
    if (aviso) {
      onAvisoSalida(aviso)
      showSnack({ msg: aviso, err: true })
    }
  }

  const enStats = pantalla === 'stats'
  const enLista = !enCal && !enStats
  // Atajo «/» para ir al buscador en Órdenes y Estadísticas (en el Calendario ya lo gestiona él).
  // No salta si se está escribiendo en un campo o hay una ventana abierta.
  useEffect(() => {
    if (mobile || enCal) return
    const h = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable], dialog')) return
      if (document.querySelector('dialog[open]')) return
      const buscar = document.getElementById('buscar')
      if (!buscar) return
      e.preventDefault()
      buscar.focus()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [mobile, enCal])
  const seccion = enCal ? 'Calendario' : enStats ? 'Estadísticas' : 'Órdenes'
  /** Las tarjetas de acceso abren su pantalla; si ya estás en ella, vuelven a Órdenes */
  const irSeccion = (p: 'calendario' | 'stats') => irA({ pantalla: pantalla === p ? 'lista' : p })
  /** Desde Estadísticas, filtrar o buscar te lleva a la lista de órdenes */
  function filtrarTarjeta(f: Filtro) {
    if (enStats) {
      setFiltro(f)
      if (f === 'FINALIZADA') setOcultarFin(false)
      irA({ pantalla: 'lista' })
    } else elegirFiltro(f)
  }
  function buscarTexto(v: string) {
    setQ(v)
    if (enStats && v) irA({ pantalla: 'lista' })
  }
  const accesos: { p: 'calendario' | 'stats'; label: string; icon: string; tour?: string }[] = [
    { p: 'calendario', label: 'Calendario', icon: 'calendar_month', tour: 'nav-cal' },
    { p: 'stats', label: 'Estadísticas', icon: 'monitoring' },
  ]
  const tarjetas = (
    <div className="stats tarjetas-top" data-tour="totales">
      {statCards.map((s) => (
        <button
          key={s.k}
          className={`stat ${s.cls ?? ''}${filtro === s.k && !enStats ? ' active' : ''}`}
          onClick={() => filtrarTarjeta(s.k)}
          aria-pressed={filtro === s.k && !enStats}
        >
          <div className="row">
            <span className="n">{s.n}</span>
            <span className="icon fill">{s.icon}</span>
          </div>
          <span className="label-l">{s.label}</span>
        </button>
      ))}
      {accesos.map((a) => {
        const aqui = pantalla === a.p
        return (
          <button
            key={a.p}
            className={`stat s-acceso${aqui ? ' active' : ''}`}
            data-tour={a.tour}
            onClick={() => irSeccion(a.p)}
            aria-pressed={aqui}
            title={aqui ? 'Volver a las órdenes' : `Abrir ${a.label.toLowerCase()}`}
          >
            <span className="icon fill">{aqui ? 'table_rows' : a.icon}</span>
            <span className="label-l">{aqui ? 'Órdenes' : a.label}</span>
          </button>
        )
      })}
    </div>
  )
  const contador = enLista && !loading && visibles.length > 0 && (
    <p className="count label-l muted">
      {visibles.length} {visibles.length === 1 ? 'orden' : 'órdenes'}
      {filtro !== 'todos' && ` · ${nombreFiltro(filtro)}`}
      {ocultarFin && ' · sin finalizadas'}
      {q && ` · «${q}»`}
    </p>
  )
  const botonesFijos = (
    <>
      <button className="icon-btn tonal" data-tour="ayuda" onClick={() => setTutorial(true)} aria-label="Cómo funciona (tutorial)" title="Cómo funciona">
        <span className="icon">help</span>
      </button>
      <button className="icon-btn tonal" data-tour="ajustes" onClick={() => irA({ pantalla: 'ajustes' })} aria-label="Ajustes" title="Ajustes">
        <span className="icon">settings</span>
      </button>
      <button className="icon-btn tonal" title={`Cerrar sesión (${email})`} aria-label="Cerrar sesión" onClick={salir}>
        <span className="icon">logout</span>
      </button>
    </>
  )

  if (pantalla === 'ajustes')
    return (
      <PlazosCtx.Provider value={ctx}>
      <RepetidosCtx.Provider value={repetidos}>
        <AgendaCtx.Provider value={agenda}>
          <Suspense fallback={CARGANDO}>
            <Ajustes festivos={festivos} festivosDeSerie={festivosDeSerie} reglas={reglas} onBack={volver} onCambio={cargarConfig} avisar={(msg, err) => showSnack({ msg, err })} />
          </Suspense>
          {snack && <SnackBar snack={snack} cerrar={() => setSnack(null)} />}
        </AgendaCtx.Provider>
      </RepetidosCtx.Provider>
      </PlazosCtx.Provider>
    )

  async function actualizarOrden(o: Orden, cambios: Partial<Orden>): Promise<boolean> {
    let r: Resultado<Orden>
    try {
      r = await (await api()).actualizarOrden(o.id, cambios)
    } catch {
      showSnack({ msg: 'No se pudo actualizar la orden: no hay conexión con el servidor.', err: true })
      return false
    }
    const { data, error } = r
    if (error !== null) {
      showSnack({ msg: 'No se pudo actualizar la orden: ' + error, err: true })
      return false
    }
    ordTocadas.current.add(o.id)
    setOrdenes((prev) => prev.map((x) => (x.id === o.id ? data : x)))
    return true
  }

  return (
    <PlazosCtx.Provider value={ctx}>
      <RepetidosCtx.Provider value={repetidos}>
     <AgendaCtx.Provider value={agenda}>
      <GestorAgenda ordenes={ordenes} festivos={ctx.festivos} abrirOrden={setEditing} actualizarOrden={actualizarOrden} avisar={avisar}>
      <div className={`app${!mobile && enLista ? ' wide' : ''}`}>
        {mobile ? (
          <>
            <header className="topbar">
              <div className="brand">
                <Logo size={42} />
                <div className="brand-txt">
                  <span className="title-l">Inspecciones</span>
                  <span className="label-m muted">Seguimiento de órdenes</span>
                </div>
              </div>
              {botonesFijos}
            </header>
            {buscando ? (
              <div className="search-m">
                <label className="search">
                  <button
                    className="icon-btn"
                    aria-label="Cerrar búsqueda"
                    onClick={() => {
                      setQ('')
                      setBuscando(false)
                    }}
                  >
                    <span className="icon">arrow_back</span>
                  </button>
                  <span className="sr-only">Buscar</span>
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => buscarTexto(e.target.value)}
                    placeholder="Nº, empresa, objeto, tareas…"
                    type="search"
                    enterKeyHint="search"
                  />
                  {q && (
                    <button className="icon-btn" onClick={() => setQ('')} aria-label="Borrar búsqueda">
                      <span className="icon">close</span>
                    </button>
                  )}
                </label>
              </div>
            ) : (
              <section className="hero-m">
                <div>
                  <h1 className="display">{seccion}</h1>
                  <p className="body-m muted" style={{ margin: '2px 0 0' }}>
                    {stats['EN CURSO'] + stats['PTE ENTREGA'] + stats.DEVUELTA} activas · {ordenes.length} en total
                  </p>
                </div>
                <div className="hero-actions">
                  <button className="icon-btn tonal" data-tour="buscar" onClick={() => setBuscando(true)} aria-label="Buscar" title="Buscar">
                    <span className="icon">search</span>
                  </button>
                  {!enStats && (
                    <button
                      className={`icon-btn tonal fin-btn${ocultarFin ? ' on' : ''}`}
                      onClick={toggleFin}
                      aria-pressed={ocultarFin}
                      aria-label={ocultarFin ? 'Mostrar finalizadas' : 'Ocultar finalizadas'}
                      title={ocultarFin ? 'Finalizadas ocultas' : 'Mostrando finalizadas'}
                    >
                      <span className="icon">{ocultarFin ? 'visibility_off' : 'visibility'}</span>
                    </button>
                  )}
                  {enLista && <SortMenu actual={sortActual} onPick={(id) => setSort(SORTS_MOVIL.find((s) => s.id === id)!.sort)} />}
                </div>
              </section>
            )}
            {tarjetas}
            {contador}
          </>
        ) : (
          /* Escritorio: tarjetas (totales + accesos a Calendario y Estadísticas) a la izquierda;
             a la derecha, buscador y botones arriba, y «Ocultar finalizadas» y exportar abajo.
             Es la misma cabecera en Órdenes, Calendario y Estadísticas, y se queda fija arriba. */
          <div className="cab-wrap">
            <div className="cabecera">
              <div className="cab-izq">
                {tarjetas}
                {contador}
              </div>
              <div className="cab-der">
                <div className="cab-fila">
                  <label className="search compacta" data-tour="buscar">
                    <span className="icon">search</span>
                    <span className="sr-only">Buscar</span>
                    <input id="buscar" value={q} onChange={(e) => buscarTexto(e.target.value)} placeholder={mobile ? 'Buscar…' : 'Buscar… ( / )'} title="Buscar nº, empresa, objeto, tareas…" type="search" enterKeyHint="search" />
                    {q && (
                      <button className="icon-btn" onClick={() => setQ('')} aria-label="Borrar búsqueda">
                        <span className="icon">close</span>
                      </button>
                    )}
                  </label>
                  {botonesFijos}
                </div>
                {!enStats && (
                  <div className="cab-fila">
                    <label className="switch-row">
                      <span className="label-l">Ocultar finalizadas</span>
                      <span className="switch">
                        <input type="checkbox" role="switch" checked={ocultarFin} onChange={toggleFin} />
                        <span className="track">
                          <span className="thumb">
                            <span className="icon">{ocultarFin ? 'check' : 'close'}</span>
                          </span>
                        </span>
                      </span>
                    </label>
                    {enLista && <SortMenu actual={sortActual} onPick={(id) => setSort(SORTS_MOVIL.find((s) => s.id === id)!.sort)} conTexto />}
                    {enLista && (
                      <button className="icon-btn" title="Exportar a Excel (CSV)" aria-label="Exportar a Excel (CSV)" onClick={() => exportarCsv(visibles, ctx, agenda.proximas)}>
                        <span className="icon">download</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {!loading && errorCarga !== null && (
          <div className={`aviso-carga${ordenes.length ? ' compacto' : ''}`} role="alert">
            <span className="icon">cloud_off</span>
            <div>
              <p className="title-m">No se pudieron cargar las órdenes</p>
              <p className="body-m">
                {errorCarga} {ordenes.length ? 'Lo que ves puede no estar al día.' : 'Tus datos no se han perdido: comprueba la conexión y vuelve a intentarlo.'}
              </p>
            </div>
            <button className="btn filled" onClick={reintentar}>
              <span className="icon">refresh</span>
              Reintentar
            </button>
          </div>
        )}
        {loading ? (
          <div className="loader">
            <span />
          </div>
        ) : errorCarga !== null && ordenes.length === 0 && enLista ? null : enStats ? (
          <Suspense fallback={CARGANDO}>
            <Estadisticas ordenes={ordenes} />
          </Suspense>
        ) : enCal ? (
          <Suspense
            fallback={
              <div className="loader">
                <span />
              </div>
            }
          >
            <Calendario ordenes={visibles} todas={ordenes} ruta={ruta} filtros={filtros} festivos={festivos} onOpen={setEditing} />
          </Suspense>
        ) : visibles.length === 0 ? (
          <div className="empty">
            <div className="blob">
              <span className="icon">{ordenes.length ? 'search_off' : 'inventory_2'}</span>
            </div>
            <h2 className="headline" style={{ color: 'var(--on-surface)' }}>
              {ordenes.length ? 'No hay resultados' : 'Aún no hay órdenes'}
            </h2>
            <p className="body-m">{ordenes.length ? 'Prueba con otra búsqueda o cambia el filtro.' : 'Pulsa «Nueva orden» para añadir la primera.'}</p>
            {ordenes.length > 0 && (
              <button
                className="btn tonal"
                onClick={() => {
                  setQ('')
                  setFiltro('todos')
                  setOcultarFin(false)
                }}
              >
                Ver todas
              </button>
            )}
          </div>
        ) : mobile ? (
          <ListaMovil ordenes={visibles} onOpen={setEditing} />
        ) : (
          <FichasOrdenes ordenes={visibles} onOpen={setEditing} />
        )}

        {enLista && (
          <button className="fab" data-tour="nueva" onClick={() => setEditing('new')} aria-label="Nueva orden">
            <span className="icon">add</span>
            <span className="fab-label">Nueva orden</span>
          </button>
        )}

        {editing && (
          <OrdenForm
            key={editing === 'new' ? 'new' : editing.id}
            orden={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
            onSaved={guardada}
            onDelete={(o) => {
              setEditing(null)
              setDeleting(o)
            }}
            onError={(msg) => showSnack({ msg, err: true })}
            todas={ordenes}
          />
        )}

        {deleting && <ConfirmDelete orden={deleting} onCancel={() => setDeleting(null)} onConfirm={() => eliminar(deleting)} />}

        {snack && <SnackBar snack={snack} cerrar={() => setSnack(null)} />}

        {tutorial && (
          <Suspense fallback={null}>
            <Tutorial ruta={ruta} onClose={() => setTutorial(false)} />
          </Suspense>
        )}

      </div>
      </GestorAgenda>
     </AgendaCtx.Provider>
    </RepetidosCtx.Provider>
      </PlazosCtx.Provider>
  )
}

function SnackBar({ snack, cerrar }: { snack: Snack; cerrar: () => void }) {
  return (
    <div className={`snackbar${snack.err ? ' err' : ''}`} role="status">
      <span>{snack.msg}</span>
      {snack.action ? (
        <button
          className="btn text"
          onClick={() => {
            cerrar()
            snack.action!.fn()
          }}
        >
          {snack.action.label}
        </button>
      ) : (
        <button className="icon-btn" onClick={cerrar} aria-label="Cerrar aviso" style={{ color: 'inherit' }}>
          <span className="icon">close</span>
        </button>
      )}
    </div>
  )
}
