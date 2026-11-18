import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import {
  ESTADOS,
  diasMinimos,
  fmtCorta,
  label,
  peorNivel,
  plazo9Meses,
  plazoSiguiente,
  type Estado,
  type Orden,
} from './lib/ordenes'
import { Login } from './components/Login'
import { Logo } from './components/Logo'
import { OrdenCard } from './components/OrdenCard'
import { Estadisticas } from './components/Estadisticas'
import { OrdenForm } from './components/OrdenForm'
import { ConfirmDelete } from './components/ConfirmDelete'
import { COLUMNAS, ColumnasMenu, ListaMovil, OCULTAS_DEF, TablaOrdenes, type Sort, type SortKey } from './components/TablaOrdenes'

type Filtro = 'todos' | 'urgentes' | 'sintiempo' | Estado
type Vista = 'tabla' | 'tarjetas'
type Snack = { msg: string; err?: boolean; action?: { label: string; fn: () => void } }

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Preferencias del usuario en este navegador
function usePref<T>(key: string, def: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('vi:' + key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  })
  const set = useCallback(
    (nv: T) => {
      setV(nv)
      try {
        localStorage.setItem('vi:' + key, JSON.stringify(nv))
      } catch {
        /* sin almacenamiento */
      }
    },
    [key],
  )
  return [v, set]
}

function useMobile() {
  const q = '(max-width: 720px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

const SORTS_MOVIL: { id: string; label: string; sort: Sort }[] = [
  { id: 'rec', label: 'Más recientes', sort: { key: 'fecha_orden', dir: 'desc' } },
  { id: 'urg', label: 'Más urgentes', sort: { key: 'urgencia', dir: 'asc' } },
  { id: 'ant', label: 'Más antiguas', sort: { key: 'fecha_orden', dir: 'asc' } },
  { id: 'emp', label: 'Empresa (A-Z)', sort: { key: 'empresa', dir: 'asc' } },
]

function valorOrden(o: Orden, k: SortKey): string | number | null {
  switch (k) {
    case 'urgencia':
      return diasMinimos(o)
    case 'lim9':
      return plazo9Meses(o)?.fecha ?? null
    case 'sig':
      return plazoSiguiente(o)?.fecha ?? null
    case 'estado':
      return ESTADOS.indexOf(o.estado)
    default:
      return (o[k] as string | null) ?? null
  }
}

function exportarCsv(rows: Orden[]) {
  const cols = COLUMNAS
  const val = (o: Orden, k: SortKey): string => {
    if (k === 'lim9') return plazo9Meses(o) ? fmtCorta(plazo9Meses(o)!.fecha) : ''
    if (k === 'sig') return plazoSiguiente(o) ? fmtCorta(plazoSiguiente(o)!.fecha) : ''
    if (k.startsWith('fecha_') && k !== 'fecha_visita') return o[k as keyof Orden] ? fmtCorta(o[k as keyof Orden] as string) : ''
    return (o[k as keyof Orden] as string | null) ?? ''
  }
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = [cols.map((c) => esc(c.label)).join(';'), ...rows.map((o) => cols.map((c) => esc(val(o, c.key))).join(';'))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined)
    return (
      <div className="loader">
        <span />
      </div>
    )
  if (!session) return <Login />
  return <Panel email={session.user.email ?? ''} />
}

function Panel({ email }: { email: string }) {
  const mobile = useMobile()
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [ocultarFin, setOcultarFin] = usePref('ocultarFin', true)
  const [vista, setVista] = usePref<Vista>('vista', 'tabla')
  const [sort, setSort] = usePref<Sort>('sort', { key: 'fecha_orden', dir: 'desc' })
  const [ocultas, setOcultas] = usePref<SortKey[]>('ocultas', OCULTAS_DEF)
  const [editing, setEditing] = useState<Orden | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Orden | null>(null)
  const [snack, setSnack] = useState<Snack | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [pantalla, setPantalla] = useState<'lista' | 'stats'>(() => (window.location.hash === '#estadisticas' ? 'stats' : 'lista'))

  useEffect(() => {
    const h = () => setPantalla(window.location.hash === '#estadisticas' ? 'stats' : 'lista')
    window.addEventListener('popstate', h)
    return () => window.removeEventListener('popstate', h)
  }, [])
  function abrirStats() {
    window.history.pushState(null, '', '#estadisticas')
    setPantalla('stats')
    window.scrollTo(0, 0)
  }
  function cerrarStats() {
    if (window.location.hash === '#estadisticas') window.history.back()
    else setPantalla('lista')
  }
  const snackTimer = useRef<number | undefined>(undefined)

  const showSnack = useCallback((s: Snack) => {
    window.clearTimeout(snackTimer.current)
    setSnack(s)
    snackTimer.current = window.setTimeout(() => setSnack(null), s.action ? 7000 : 4000)
  }, [])

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('ordenes').select('*').order('fecha_orden', { ascending: false })
    if (error) showSnack({ msg: 'Error al cargar: ' + error.message, err: true })
    else setOrdenes(data as Orden[])
    setLoading(false)
  }, [showSnack])

  useEffect(() => {
    cargar()
  }, [cargar])

  const stats = useMemo(() => {
    const s = { 'EN CURSO': 0, 'PTE ENTREGA': 0, FINALIZADA: 0, urgentes: 0, sintiempo: 0 }
    for (const o of ordenes) {
      s[o.estado]++
      const n = peorNivel(o)
      if (n === 'urgente') s.urgentes++
      if (n === 'vencido') s.sintiempo++
    }
    return s
  }, [ordenes])

  const visibles = useMemo(() => {
    const t = normal(q.trim())
    const list = ordenes.filter((o) => {
      if (ocultarFin && o.estado === 'FINALIZADA') return false
      if (filtro === 'urgentes' && peorNivel(o) !== 'urgente') return false
      if (filtro === 'sintiempo' && peorNivel(o) !== 'vencido') return false
      if ((ESTADOS as readonly string[]).includes(filtro) && o.estado !== filtro) return false
      if (!t) return true
      return normal(
        [o.num_orden, o.empresa, o.objeto, o.situacion_general, o.tareas_pendientes, o.fecha_visita].join(' '),
      ).includes(t)
    })
    const m = sort.dir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      const va = valorOrden(a, sort.key)
      const vb = valorOrden(b, sort.key)
      if (va === vb) return (b.fecha_orden ?? '').localeCompare(a.fecha_orden ?? '')
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * m
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * m
    })
  }, [ordenes, q, filtro, ocultarFin, sort])

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
    setOrdenes((prev) => (nueva ? [o, ...prev] : prev.map((x) => (x.id === o.id ? o : x))))
    showSnack({ msg: nueva ? 'Orden creada' : 'Cambios guardados' })
  }

  async function eliminar(o: Orden) {
    setDeleting(null)
    const { error } = await supabase.from('ordenes').delete().eq('id', o.id)
    if (error) return showSnack({ msg: 'No se pudo eliminar: ' + error.message, err: true })
    setOrdenes((prev) => prev.filter((x) => x.id !== o.id))
    showSnack({
      msg: 'Orden eliminada',
      action: {
        label: 'Deshacer',
        fn: async () => {
          const { updated_at, ...rest } = o
          void updated_at
          const { data, error } = await supabase.from('ordenes').insert(rest).select().single()
          if (error) return showSnack({ msg: 'No se pudo restaurar: ' + error.message, err: true })
          setOrdenes((prev) => [data as Orden, ...prev])
          showSnack({ msg: 'Orden restaurada' })
        },
      },
    })
  }

  const statCards: { k: Filtro; label: string; n: number; icon: string; cls?: string }[] = [
    { k: 'EN CURSO', label: 'En curso', n: stats['EN CURSO'], icon: 'progress_activity', cls: 's-curso' },
    { k: 'PTE ENTREGA', label: 'Pte. entrega', n: stats['PTE ENTREGA'], icon: 'hourglass_top', cls: 's-pte' },
    { k: 'urgentes', label: 'Menos de 30 días', n: stats.urgentes, icon: 'warning', cls: 's-urg' },
    { k: 'sintiempo', label: 'Sin tiempo', n: stats.sintiempo, icon: 'error', cls: 's-venc' },
  ]

  const sortActual = SORTS_MOVIL.find((s) => s.sort.key === sort.key && s.sort.dir === sort.dir)?.id ?? ''
  const verTabla = vista === 'tabla'

  if (pantalla === 'stats')
    return (
      <div className="app">
        <Estadisticas ordenes={ordenes} onBack={cerrarStats} />
      </div>
    )

  return (
    <div className={`app${verTabla && !mobile ? ' wide' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <Logo size={mobile ? 42 : 48} />
          <div className="brand-txt">
            <span className="title-l">Inspecciones</span>
            <span className="label-m muted">Seguimiento de órdenes</span>
          </div>
        </div>
        {mobile ? (
          <button className="icon-btn tonal stats-btn" onClick={abrirStats} aria-label="Estadísticas" title="Estadísticas">
            <span className="icon">monitoring</span>
          </button>
        ) : (
          <button className="btn tonal stats-btn" onClick={abrirStats}>
            <span className="icon">monitoring</span>
            Estadísticas
          </button>
        )}
        <button className="icon-btn tonal" title={`Cerrar sesión (${email})`} aria-label="Cerrar sesión" onClick={() => supabase.auth.signOut()}>
          <span className="icon">logout</span>
        </button>
      </header>

      {mobile ? (
        buscando ? (
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
                onChange={(e) => setQ(e.target.value)}
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
              <h1 className="display">Órdenes</h1>
              <p className="body-m muted" style={{ margin: '2px 0 0' }}>
                {stats['EN CURSO'] + stats['PTE ENTREGA']} activas · {ordenes.length} en total
              </p>
            </div>
            <div className="hero-actions">
              <button className="icon-btn tonal" onClick={() => setBuscando(true)} aria-label="Buscar" title="Buscar">
                <span className="icon">search</span>
              </button>
              <button
                className={`icon-btn tonal fin-btn${ocultarFin ? ' on' : ''}`}
                onClick={toggleFin}
                aria-pressed={ocultarFin}
                aria-label={ocultarFin ? 'Mostrar finalizadas' : 'Ocultar finalizadas'}
                title={ocultarFin ? 'Finalizadas ocultas' : 'Mostrando finalizadas'}
              >
                <span className="icon">{ocultarFin ? 'visibility_off' : 'visibility'}</span>
              </button>
              <SortMenu actual={sortActual} onPick={(id) => setSort(SORTS_MOVIL.find((s) => s.id === id)!.sort)} />
            </div>
          </section>
        )
      ) : (
        <section className="hero">
          <div>
            <h1 className="display">Órdenes</h1>
            <p className="body-m muted" style={{ margin: '6px 0 0' }}>
              {ordenes.length} en total · {stats['EN CURSO'] + stats['PTE ENTREGA']} activas
            </p>
          </div>
          <label className="search">
            <span className="icon">search</span>
            <span className="sr-only">Buscar</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nº, empresa, objeto, tareas…" type="search" enterKeyHint="search" />
            {q && (
              <button className="icon-btn" onClick={() => setQ('')} aria-label="Borrar búsqueda">
                <span className="icon">close</span>
              </button>
            )}
          </label>
        </section>
      )}

      <div className="stats">
        {statCards.map((s) => (
          <button key={s.k} className={`stat ${s.cls ?? ''}${filtro === s.k ? ' active' : ''}`} onClick={() => elegirFiltro(s.k)} aria-pressed={filtro === s.k}>
            <div className="row">
              <span className="n">{s.n}</span>
              <span className="icon fill">{s.icon}</span>
            </div>
            <span className="label-l">{s.label}</span>
          </button>
        ))}
      </div>

      {!mobile && (
        <div className="toolbar">
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

          <div className="toolbar-end">
            {!verTabla && <SortMenu actual={sortActual} onPick={(id) => setSort(SORTS_MOVIL.find((s) => s.id === id)!.sort)} conTexto />}
            {verTabla && <ColumnasMenu ocultas={ocultas} setOcultas={setOcultas} />}
            <button className="icon-btn" title="Exportar a Excel (CSV)" aria-label="Exportar a Excel (CSV)" onClick={() => exportarCsv(visibles)}>
              <span className="icon">download</span>
            </button>
            <div className="seg mini" role="radiogroup" aria-label="Vista">
              <button role="radio" aria-checked={verTabla} className={verTabla ? 'on' : ''} onClick={() => setVista('tabla')} title="Tabla">
                <span className="icon">table_rows</span>
                <span className="sr-only">Tabla</span>
              </button>
              <button role="radio" aria-checked={!verTabla} className={!verTabla ? 'on' : ''} onClick={() => setVista('tarjetas')} title="Tarjetas">
                <span className="icon">grid_view</span>
                <span className="sr-only">Tarjetas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && visibles.length > 0 && (
        <p className="count label-l muted">
          {visibles.length} {visibles.length === 1 ? 'orden' : 'órdenes'}
          {filtro !== 'todos' && ` · ${label(filtro === 'urgentes' ? 'Menos de 30 días' : filtro === 'sintiempo' ? 'Sin tiempo' : filtro)}`}
          {ocultarFin && ' · sin finalizadas'}
          {q && ` · «${q}»`}
        </p>
      )}

      {loading ? (
        <div className="loader">
          <span />
        </div>
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
      ) : verTabla ? (
        <TablaOrdenes ordenes={visibles} sort={sort} setSort={setSort} ocultas={ocultas} onOpen={setEditing} />
      ) : (
        <div className="grid">
          {visibles.map((o, i) => (
            <OrdenCard key={o.id} orden={o} index={i} onOpen={() => setEditing(o)} />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')} aria-label="Nueva orden">
        <span className="icon">add</span>
        <span className="fab-label">Nueva orden</span>
      </button>

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
        />
      )}

      {deleting && <ConfirmDelete orden={deleting} onCancel={() => setDeleting(null)} onConfirm={() => eliminar(deleting)} />}

      {snack && (
        <div className={`snackbar${snack.err ? ' err' : ''}`} role="status">
          <span>{snack.msg}</span>
          {snack.action ? (
            <button
              className="btn text"
              onClick={() => {
                setSnack(null)
                snack.action!.fn()
              }}
            >
              {snack.action.label}
            </button>
          ) : (
            <button className="icon-btn" onClick={() => setSnack(null)} aria-label="Cerrar aviso" style={{ color: 'inherit' }}>
              <span className="icon">close</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
