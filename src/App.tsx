import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ESTADOS, LABELS, diasMinimos, peorNivel, type Estado, type Orden } from './lib/ordenes'
import { Login } from './components/Login'
import { OrdenCard, ESTADO_ICONO } from './components/OrdenCard'
import { OrdenForm } from './components/OrdenForm'
import { ConfirmDelete } from './components/ConfirmDelete'

type Filtro = 'todas' | 'activas' | 'urgentes' | 'vencidas' | Estado
type Orden_ = 'urgencia' | 'recientes' | 'empresa'
type Snack = { msg: string; err?: boolean; action?: { label: string; fn: () => void } }

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

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
  const [ordenes, setOrdenes] = useState<Orden[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('activas')
  const [orden, setOrden] = useState<Orden_>('urgencia')
  const [editing, setEditing] = useState<Orden | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Orden | null>(null)
  const [snack, setSnack] = useState<Snack | null>(null)
  const snackTimer = useRef<number | undefined>(undefined)

  const showSnack = useCallback((s: Snack) => {
    window.clearTimeout(snackTimer.current)
    setSnack(s)
    snackTimer.current = window.setTimeout(() => setSnack(null), s.action ? 7000 : 4000)
  }, [])

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('ordenes').select('*').order('created_at', { ascending: false })
    if (error) showSnack({ msg: 'Error al cargar: ' + error.message, err: true })
    else setOrdenes(data as Orden[])
    setLoading(false)
  }, [showSnack])

  useEffect(() => {
    cargar()
  }, [cargar])

  const stats = useMemo(() => {
    let activas = 0, urgentes = 0, vencidas = 0, finalizadas = 0
    for (const o of ordenes) {
      if (o.estado === 'FINALIZADA') finalizadas++
      else activas++
      const n = peorNivel(o)
      if (n === 'urgente') urgentes++
      if (n === 'vencido') vencidas++
    }
    return { activas, urgentes, vencidas, finalizadas }
  }, [ordenes])

  const visibles = useMemo(() => {
    const t = normal(q.trim())
    let list = ordenes.filter((o) => {
      if (filtro === 'activas' && o.estado === 'FINALIZADA') return false
      if (filtro === 'urgentes' && peorNivel(o) !== 'urgente') return false
      if (filtro === 'vencidas' && peorNivel(o) !== 'vencido') return false
      if ((ESTADOS as readonly string[]).includes(filtro) && o.estado !== filtro) return false
      if (!t) return true
      return normal(
        [o.num_orden, o.empresa, o.situacion_general, o.tareas_pendientes, o.visitas_realizadas, o.docum_aportada].join(' '),
      ).includes(t)
    })
    list = [...list].sort((a, b) => {
      if (orden === 'empresa') return a.empresa.localeCompare(b.empresa, 'es')
      if (orden === 'recientes') return b.created_at.localeCompare(a.created_at)
      return diasMinimos(a) - diasMinimos(b)
    })
    return list
  }, [ordenes, q, filtro, orden])

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
          const { created_at, updated_at, ...rest } = o
          void updated_at
          const { data, error } = await supabase
            .from('ordenes')
            .insert({ ...rest, created_at })
            .select()
            .single()
          if (error) return showSnack({ msg: 'No se pudo restaurar: ' + error.message, err: true })
          setOrdenes((prev) => [data as Orden, ...prev])
          showSnack({ msg: 'Orden restaurada' })
        },
      },
    })
  }

  const statCards: { k: Filtro; label: string; n: number; icon: string; cls?: string }[] = [
    { k: 'activas', label: 'Activas', n: stats.activas, icon: 'pending_actions' },
    { k: 'urgentes', label: 'Menos de 30 días', n: stats.urgentes, icon: 'warning', cls: 's-urg' },
    { k: 'vencidas', label: 'Vencidas', n: stats.vencidas, icon: 'error', cls: 's-venc' },
    { k: 'FINALIZADA', label: 'Finalizadas', n: stats.finalizadas, icon: 'task_alt' },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="icon fill">fact_check</span>
          </div>
          <span className="title-l">Inspecciones</span>
        </div>
        <button
          className="icon-btn tonal"
          title={`Cerrar sesión (${email})`}
          aria-label="Cerrar sesión"
          onClick={() => supabase.auth.signOut()}
        >
          <span className="icon">logout</span>
        </button>
      </header>

      <section className="hero">
        <div>
          <h1 className="display">Órdenes</h1>
          <p className="body-m muted" style={{ margin: '6px 0 0' }}>
            {ordenes.length} {ordenes.length === 1 ? 'orden registrada' : 'órdenes registradas'}
          </p>
        </div>
        <label className="search">
          <span className="icon">search</span>
          <span className="sr-only">Buscar</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nº, empresa, tareas…" type="search" />
          {q && (
            <button className="icon-btn" onClick={() => setQ('')} aria-label="Borrar búsqueda">
              <span className="icon">close</span>
            </button>
          )}
        </label>
      </section>

      <div className="stats">
        {statCards.map((s) => (
          <button
            key={s.k}
            className={`stat ${s.cls ?? ''}${filtro === s.k ? ' active' : ''}`}
            onClick={() => setFiltro(filtro === s.k ? 'todas' : s.k)}
            aria-pressed={filtro === s.k}
          >
            <div className="row">
              <span className="n">{s.n}</span>
              <span className="icon fill">{s.icon}</span>
            </div>
            <span className="label-l">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="chips" role="group" aria-label="Filtrar por estado">
          {(['todas', ...ESTADOS] as Filtro[]).map((k) => (
            <button key={k} className={`chip${filtro === k ? ' on' : ''}`} onClick={() => setFiltro(k)} aria-pressed={filtro === k}>
              {filtro === k ? <span className="icon">check</span> : k !== 'todas' && <span className="icon">{ESTADO_ICONO[k]}</span>}
              {k === 'todas' ? 'Todas' : LABELS[k]}
            </button>
          ))}
        </div>
        <label className="sort">
          <span className="icon">sort</span>
          <span className="sr-only">Ordenar por</span>
          <select value={orden} onChange={(e) => setOrden(e.target.value as Orden_)}>
            <option value="urgencia">Más urgentes</option>
            <option value="recientes">Más recientes</option>
            <option value="empresa">Empresa (A-Z)</option>
          </select>
        </label>
      </div>

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
          <p className="body-m">
            {ordenes.length ? 'Prueba con otra búsqueda o cambia el filtro.' : 'Pulsa «Nueva orden» para añadir la primera.'}
          </p>
          {ordenes.length > 0 && (
            <button
              className="btn tonal"
              onClick={() => {
                setQ('')
                setFiltro('todas')
              }}
            >
              Ver todas
            </button>
          )}
        </div>
      ) : (
        <div className="grid">
          {visibles.map((o, i) => (
            <OrdenCard key={o.id} orden={o} index={i} onOpen={() => setEditing(o)} />
          ))}
        </div>
      )}

      <button className="fab" onClick={() => setEditing('new')}>
        <span className="icon">add</span>
        Nueva orden
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
