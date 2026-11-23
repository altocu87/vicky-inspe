import { useEffect, useRef, useState } from 'react'
import { usePlazosCtx } from '../hooks'
import { fmtCorta, label, textoDias, type Orden } from '../lib/ordenes'
import { plazoActivoDe, type PlazoCalc } from '../lib/plazos/motor'
import { ESTADO_CLASE } from './estados'
import { BotonProgramar, BotonVerCalendario, MarcaInhabil } from './plazos'
import { useAgenda } from '../state/agenda'
import { COLUMNAS, proximoOtros, type Sort, type SortKey } from './columnas'
import { ProximaVisita } from './celdas'

export type { Sort, SortKey } from './columnas'

const OCULTAS_DEF: SortKey[] = ['fecha_primera_actuacion', 'fecha_ultima_actuacion', 'fecha_visita']

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
  const { proximas } = useAgenda()
  const cols = COLUMNAS.filter((c) => !ocultas.includes(c.key))
  let left = 0
  const sticky = new Map<SortKey, number>()
  for (const c of cols.filter((c) => c.fixed)) {
    sticky.set(c.key, left)
    left += c.width ?? 120
  }

  return (
    <div className="table-wrap" role="region" aria-label="Tabla de órdenes" tabIndex={0} data-tour="lista">
      <table className="xtable">
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
          <col style={{ width: 100 }} />
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
                  {c.render(o, ctx, proximas)}
                </td>
              ))}
              <td className="acc">
                {o.estado !== 'FINALIZADA' && <BotonProgramar orden={o} />}
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
  const { proximas } = useAgenda()
  return (
    <ul className="mlist" data-tour="lista">
      {ordenes.map((o) => {
        const fin = o.estado === 'FINALIZADA'
        const p9 = plazoActivoDe(o, 'lim9', ctx)
        const ps = plazoActivoDe(o, 'sig', ctx)
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
              {!fin && (
                <span className="mrow-visita">
                  <span className="label-m muted">Próxima visita:</span> <ProximaVisita o={o} ctx={ctx} prox={proximas} compacta />
                </span>
              )}
              {!fin && o.tareas_pendientes && <span className="mrow-task">{o.tareas_pendientes}</span>}
            </button>
            <span className="mrow-acc">
              <BotonVerCalendario orden={o} className="mrow-cal" />
              {!fin && <BotonProgramar orden={o} />}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
