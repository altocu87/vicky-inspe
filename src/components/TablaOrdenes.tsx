import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePlazosCtx } from '../hooks'
import { fmtCorta, label, textoDias, type Orden } from '../lib/ordenes'
import { plazoDe, proximoPlazo, type ContextoPlazos, type PlazoCalc } from '../lib/plazos/motor'
import { ESTADO_CLASE } from './OrdenCard'
import { BotonVerCalendario, MarcaInhabil } from './plazos'

export type SortKey =
  | 'num_orden'
  | 'empresa'
  | 'estado'
  | 'fecha_orden'
  | 'fecha_primera_actuacion'
  | 'lim9'
  | 'fecha_ultima_actuacion'
  | 'sig'
  | 'objeto'
  | 'estado_docum'
  | 'estado_visita'
  | 'fecha_visita'
  | 'situacion_general'
  | 'tareas_pendientes'
  | 'comparecencia_subida'
  | 'doc_subida'
  | 'claves'
  | 'prox'
  | 'urgencia'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

type Col = {
  key: SortKey
  label: string
  short?: string
  width?: number
  fixed?: boolean // no se puede ocultar
  align?: 'center' | 'right'
  render: (o: Orden, ctx: ContextoPlazos) => ReactNode
  title?: (o: Orden) => string | undefined
}

function Dias({ p, fin, conTipo }: { p: PlazoCalc | null; fin: boolean; conTipo?: boolean }) {
  if (!p) return <span className="muted">—</span>
  if (fin) return <span className="muted">{fmtCorta(p.fecha)}</span>
  return (
    <span className="dcell">
      <span className="dfecha">{fmtCorta(p.fecha)}</span>
      <MarcaInhabil inhabil={p.inhabil} />
      <span className={`dpill n-${p.nivel}`}>{textoDias(p.dias)}</span>
      {conTipo && <span className="dtipo">{p.regla.corto}</span>}
    </span>
  )
}

function SiNoCell({ v }: { v: string | null }) {
  if (v === 'SI')
    return (
      <span className="sino si" title="Sí">
        <span className="icon fill">check_circle</span>
      </span>
    )
  if (v === 'NO SE PONE')
    return (
      <span className="sino no" title="No se pone">
        <span className="icon">remove</span>
      </span>
    )
  return (
    <span className="sino pte" title="Pendiente">
      <span className="icon">radio_button_unchecked</span>
    </span>
  )
}

const txt = (v: string | null) => (v ? <span className="clip">{v}</span> : <span className="muted">—</span>)

export const COLUMNAS: Col[] = [
  { key: 'num_orden', label: 'Nº orden', width: 128, fixed: true, render: (o) => <span className="mono">{o.num_orden}</span> },
  {
    key: 'empresa',
    label: 'Empresa',
    width: 240,
    fixed: true,
    render: (o) => <span className="clip strong">{o.empresa}</span>,
    title: (o) => o.empresa,
  },
  {
    key: 'estado',
    label: 'Estado',
    width: 128,
    render: (o) => <span className={`badge sm ${ESTADO_CLASE[o.estado]}`}>{label(o.estado)}</span>,
  },
  { key: 'fecha_orden', label: 'Fecha orden', short: 'F. orden', width: 96, render: (o) => fmtCorta(o.fecha_orden) },
  { key: 'fecha_primera_actuacion', label: '1ª actuación', short: '1ª act.', width: 96, render: (o) => fmtCorta(o.fecha_primera_actuacion) },
  {
    key: 'lim9',
    label: 'Límite 9 meses',
    short: 'Límite 9 m',
    width: 168,
    render: (o, ctx) => <Dias p={plazoDe(o, 'lim9', ctx)} fin={o.estado === 'FINALIZADA'} />,
  },
  { key: 'fecha_ultima_actuacion', label: 'Última actuación', short: 'Últ. act.', width: 96, render: (o) => fmtCorta(o.fecha_ultima_actuacion) },
  {
    key: 'sig',
    label: 'Límite siguiente actuación',
    short: 'Límite sig.',
    width: 168,
    render: (o, ctx) => <Dias p={plazoDe(o, 'sig', ctx)} fin={o.estado === 'FINALIZADA'} />,
  },
  {
    key: 'prox',
    label: 'Próximo plazo',
    short: 'Próx. plazo',
    width: 200,
    render: (o, ctx) => (o.estado === 'FINALIZADA' ? <span className="muted">—</span> : <Dias p={proximoPlazo(o, ctx)} fin={false} conTipo />),
  },
  { key: 'objeto', label: 'Objeto', width: 220, render: (o) => txt(o.objeto), title: (o) => o.objeto ?? undefined },
  {
    key: 'estado_docum',
    label: 'Documentación',
    short: 'Docum.',
    width: 116,
    render: (o) => <span className={`tag d-${(o.estado_docum ?? '').replace(/\s/g, '')}`}>{label(o.estado_docum)}</span>,
  },
  { key: 'estado_visita', label: 'Visita', width: 150, render: (o) => txt(label(o.estado_visita)), title: (o) => o.estado_visita ?? undefined },
  { key: 'fecha_visita', label: 'Fecha visita', short: 'F. visita', width: 140, render: (o) => txt(o.fecha_visita), title: (o) => o.fecha_visita ?? undefined },
  {
    key: 'situacion_general',
    label: 'Situación general',
    short: 'Situación',
    width: 260,
    render: (o) => txt(o.situacion_general),
    title: (o) => o.situacion_general ?? undefined,
  },
  {
    key: 'tareas_pendientes',
    label: 'Tareas pendientes',
    short: 'Tareas',
    width: 260,
    render: (o) => txt(o.tareas_pendientes),
    title: (o) => o.tareas_pendientes ?? undefined,
  },
  {
    key: 'comparecencia_subida',
    label: '¿Comparecencia subida?',
    short: 'Comp.',
    width: 72,
    align: 'center',
    render: (o) => <SiNoCell v={o.comparecencia_subida} />,
  },
  { key: 'doc_subida', label: '¿Doc. subida?', short: 'Doc.', width: 64, align: 'center', render: (o) => <SiNoCell v={o.doc_subida} /> },
  { key: 'claves', label: 'Claves', width: 68, align: 'center', render: (o) => <SiNoCell v={o.claves} /> },
]

export const OCULTAS_DEF: SortKey[] = ['fecha_primera_actuacion', 'fecha_ultima_actuacion', 'fecha_visita']

/** Selector de columnas visibles */
export function ColumnasMenu({ ocultas, setOcultas }: { ocultas: SortKey[]; setOcultas: (v: SortKey[]) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="btn outlined sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="icon">view_column</span>
        Columnas
      </button>
      {open && (
        <div className="menu" role="menu">
          {COLUMNAS.filter((c) => !c.fixed).map((c) => {
            const on = !ocultas.includes(c.key)
            return (
              <label key={c.key} className="menu-item" role="menuitemcheckbox" aria-checked={on}>
                <input type="checkbox" checked={on} onChange={() => setOcultas(on ? [...ocultas, c.key] : ocultas.filter((k) => k !== c.key))} />
                <span className="check">
                  <span className="icon">check</span>
                </span>
                {c.label}
              </label>
            )
          })}
          <button className="btn text sm" style={{ alignSelf: 'flex-end', marginTop: 4 }} onClick={() => setOcultas(OCULTAS_DEF)}>
            Restablecer
          </button>
        </div>
      )}
    </div>
  )
}

export function TablaOrdenes({
  ordenes,
  sort,
  setSort,
  ocultas,
  onOpen,
}: {
  ordenes: Orden[]
  sort: Sort
  setSort: (s: Sort) => void
  ocultas: SortKey[]
  onOpen: (o: Orden) => void
}) {
  const ctx = usePlazosCtx()
  const cols = COLUMNAS.filter((c) => !ocultas.includes(c.key))
  let left = 0
  const sticky = new Map<SortKey, number>()
  for (const c of cols.filter((c) => c.fixed)) {
    sticky.set(c.key, left)
    left += c.width ?? 120
  }

  return (
    <div className="table-wrap" role="region" aria-label="Tabla de órdenes" tabIndex={0}>
      <table className="xtable">
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
          <col style={{ width: 52 }} />
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => {
              const active = sort.key === c.key
              return (
                <th
                  key={c.key}
                  className={`${sticky.has(c.key) ? 'stick' : ''}${c.key === 'empresa' ? ' last-stick' : ''}${c.align ? ' ' + c.align : ''}`}
                  style={sticky.has(c.key) ? { left: sticky.get(c.key) } : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    className={`th-btn${active ? ' on' : ''}`}
                    title={c.label}
                    onClick={() =>
                      setSort({ key: c.key, dir: active && sort.dir === 'desc' ? 'asc' : active ? 'desc' : c.key.startsWith('fecha') ? 'desc' : 'asc' })
                    }
                  >
                    <span>{c.short ?? c.label}</span>
                    <span className="icon sort-ic">{active ? (sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}</span>
                  </button>
                </th>
              )
            })}
            <th className="acc">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ordenes.map((o) => (
            <tr
              key={o.id}
              className={`${ESTADO_CLASE[o.estado]}${o.estado === 'FINALIZADA' ? ' fin' : ''}`}
              tabIndex={0}
              onClick={() => onOpen(o)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(o))}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`${sticky.has(c.key) ? 'stick' : ''}${c.key === 'empresa' ? ' last-stick' : ''}${c.align ? ' ' + c.align : ''}`}
                  style={sticky.has(c.key) ? { left: sticky.get(c.key) } : undefined}
                  title={c.title?.(o)}
                >
                  {c.render(o, ctx)}
                </td>
              ))}
              <td className="acc">
                <BotonVerCalendario orden={o} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Lista compacta para móvil */
export function ListaMovil({ ordenes, onOpen }: { ordenes: Orden[]; onOpen: (o: Orden) => void }) {
  const ctx = usePlazosCtx()
  return (
    <ul className="mlist">
      {ordenes.map((o) => {
        const fin = o.estado === 'FINALIZADA'
        const p9 = plazoDe(o, 'lim9', ctx)
        const ps = plazoDe(o, 'sig', ctx)
        const otros = fin ? [] : proximoOtros(o, ctx)
        return (
          <li key={o.id}>
            <button className={`mrow ${ESTADO_CLASE[o.estado]}${fin ? ' fin' : ''}`} onClick={() => onOpen(o)}>
              <div className="mrow-top">
                <span className="mrow-emp">{o.empresa}</span>
                <span className={`badge sm ${ESTADO_CLASE[o.estado]}`}>{label(o.estado)}</span>
              </div>
              <div className="mrow-sub">
                <span className="mono">{o.num_orden}</span>
                <span aria-hidden>·</span>
                <span>{fmtCorta(o.fecha_orden)}</span>
              </div>
              {!fin && (p9 || ps || otros.length > 0) && (
                <div className="mrow-plazos">
                  {[p9, ps, ...otros]
                    .filter((p): p is PlazoCalc => !!p)
                    .map((p) => (
                      <span key={p.regla.id} className={`mp n-${p.nivel}`}>
                        <span className="mp-l">{p.regla.corto}</span>
                        <span className="mp-v">{textoDias(p.dias)}</span>
                        <MarcaInhabil inhabil={p.inhabil} />
                      </span>
                    ))}
                </div>
              )}
              {!fin && o.tareas_pendientes && <span className="mrow-task">{o.tareas_pendientes}</span>}
            </button>
            <BotonVerCalendario orden={o} className="mrow-cal" />
          </li>
        )
      })}
    </ul>
  )
}

/** Plazos de reglas añadidas en Ajustes (las dos del Excel ya se muestran aparte) */
function proximoOtros(o: Orden, ctx: ContextoPlazos): PlazoCalc[] {
  return ctx.reglas
    .filter((r) => r.id !== 'lim9' && r.id !== 'sig' && r.activa)
    .map((r) => plazoDe(o, r.id, ctx))
    .filter((p): p is PlazoCalc => !!p && p.aplica)
}
