// Piezas pequeñas de los formularios de la agenda.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { normal } from '../../lib/filtros'
import type { Orden } from '../../lib/ordenes'
import { useMobile } from '../../hooks'

/** Diálogo modal: a pantalla completa en el móvil (o como hoja inferior si `hoja`) */
export function Dialogo({
  titulo,
  onClose,
  children,
  pie,
  hoja,
  pequeno,
  etiqueta,
}: {
  titulo: ReactNode
  onClose: () => void
  children: ReactNode
  pie?: ReactNode
  /** En el móvil, hoja que sube desde abajo (fichas rápidas) */
  hoja?: boolean
  pequeno?: boolean
  etiqueta?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const mobile = useMobile()
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])
  const id = useMemo(() => 'dlg-' + Math.random().toString(36).slice(2, 8), [])
  return (
    <dialog
      ref={ref}
      className={`${hoja && mobile ? 'sheet' : 'full'}${pequeno && !mobile ? ' small' : ''}`}
      aria-labelledby={id}
      aria-label={etiqueta}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Pulsar fuera (en el fondo) cierra
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="dlg">
        <div className="dlg-head">
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <span className="icon">close</span>
          </button>
          <h2 id={id} className="headline">
            {titulo}
          </h2>
        </div>
        <div className="dlg-body">{children}</div>
        {pie && <div className="dlg-foot">{pie}</div>}
      </div>
    </dialog>
  )
}

/** Buscar y elegir una orden (o ninguna) */
export function SelectorOrden({ ordenes, valor, onChange, id }: { ordenes: readonly Orden[]; valor: string | null; onChange: (id: string | null) => void; id: string }) {
  const [q, setQ] = useState('')
  const elegida = valor ? ordenes.find((o) => o.id === valor) : undefined
  const res = useMemo(() => {
    const t = normal(q.trim())
    if (!t) return []
    return ordenes.filter((o) => normal(`${o.num_orden} ${o.empresa}`).includes(t)).slice(0, 8)
  }, [q, ordenes])
  if (elegida)
    return (
      <div className="sel-orden">
        <span className="label-l muted">Orden</span>
        <span className="sel-chip">
          <span className="icon">link</span>
          <span className="sel-txt">
            <strong>{elegida.empresa}</strong> <span className="mono muted">{elegida.num_orden}</span>
          </span>
          <button type="button" className="icon-btn" aria-label="Quitar la orden" onClick={() => onChange(null)}>
            <span className="icon">close</span>
          </button>
        </span>
      </div>
    )
  return (
    <div className="field sel-orden">
      <label htmlFor={id}>Orden (opcional)</label>
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nº o empresa" autoComplete="off" />
      {res.length > 0 && (
        <ul className="sel-lista" role="listbox" aria-label="Órdenes encontradas">
          {res.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange(o.id)
                  setQ('')
                }}
              >
                <strong>{o.empresa}</strong>
                <span className="mono muted">{o.num_orden}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Interruptor con texto */
export function Interruptor({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch-row">
      <span className="label-l">{label}</span>
      <span className="switch">
        <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="track">
          <span className="thumb">
            <span className="icon">{checked ? 'check' : 'close'}</span>
          </span>
        </span>
      </span>
    </label>
  )
}

/** Grupo de botones excluyentes (como el de OrdenForm) */
export function Opciones<T extends string>({
  label,
  opciones,
  valor,
  onChange,
  nombres,
  iconos,
}: {
  label: string
  opciones: readonly T[]
  valor: T
  onChange: (v: T) => void
  nombres: Record<string, string>
  iconos?: Record<string, string>
}) {
  return (
    <div className="seg-wrap" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div className="seg wrap">
        {opciones.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={valor === o} className={valor === o ? 'on' : ''} onClick={() => onChange(o)}>
            {valor === o ? <span className="icon">check</span> : iconos?.[o] && <span className="icon">{iconos[o]}</span>}
            {nombres[o] ?? o}
          </button>
        ))}
      </div>
    </div>
  )
}
