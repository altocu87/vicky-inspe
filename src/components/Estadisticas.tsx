import { useMemo, useState } from 'react'
import type { Orden } from '../lib/ordenes'
import { cerradaDentroDe9Meses } from '../lib/estadisticas'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
const media = (v: number[]) => (v.length ? Math.round(v.reduce((x, y) => x + y, 0) / v.length) : null)

/** Duración de cierre en días (orden -> cierre), solo si es coherente */
function duracion(o: Orden): number | null {
  if (o.estado !== 'FINALIZADA' || !o.fecha_cierre || !o.fecha_orden) return null
  const d = dias(o.fecha_orden, o.fecha_cierre)
  return d >= 0 ? d : null
}

type Punto = { key: string; label: string; largo: string; value: number | null; detalle: string }

function niceMax(v: number) {
  if (v <= 0) return 10
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

/** Gráfico de barras de una sola serie, con tooltip al pasar o tocar */
function Barras({ datos, color, unidad, titulo, vacio }: { datos: Punto[]; color: string; unidad: string; titulo: string; vacio: string }) {
  const [act, setAct] = useState<number | null>(null)
  const vals = datos.map((d) => d.value ?? 0)
  const max = niceMax(Math.max(...vals, 0))
  const ticks = [0, max / 2, max]
  const conDatos = datos.some((d) => d.value !== null && d.value > 0)
  // Etiquetas directas solo en el máximo y el último con datos
  const iMax = vals.indexOf(Math.max(...vals))
  let iUlt = -1
  datos.forEach((d, i) => d.value !== null && d.value > 0 && (iUlt = i))

  return (
    <figure className="chart" aria-label={titulo}>
      {!conDatos ? (
        <p className="body-m muted chart-empty">{vacio}</p>
      ) : (
        <div className="chart-plot" onMouseLeave={() => setAct(null)}>
          <div className="chart-y" aria-hidden>
            {ticks.map((t) => (
              <span key={t} style={{ bottom: `calc(22px + (100% - 22px) * ${t / max})` }}>
                {Math.round(t)}
              </span>
            ))}
          </div>
          <div className="chart-area">
            {ticks.map((t) => (
              <div key={t} className="chart-grid" style={{ bottom: `calc(22px + (100% - 22px) * ${t / max})` }} />
            ))}
            <div className="chart-bars" style={{ ['--bar' as string]: color }}>
              {datos.map((d, i) => {
                const h = d.value ? (d.value / max) * 100 : 0
                const showLabel = d.value !== null && d.value > 0 && (i === iMax || i === iUlt)
                return (
                  <button
                    key={d.key}
                    type="button"
                    className={`bar-slot${act === i ? ' on' : ''}`}
                    onMouseEnter={() => setAct(i)}
                    onFocus={() => setAct(i)}
                    onBlur={() => setAct(null)}
                    onClick={() => setAct(i)}
                    aria-label={`${d.largo}: ${d.value ?? 'sin datos'}${d.value !== null ? ' ' + unidad : ''}. ${d.detalle}`}
                  >
                    <span className="bar" style={{ height: `${h}%` }}>
                      {showLabel && act === null && <span className="bar-lbl">{d.value}</span>}
                    </span>
                    {act === i && (
                      <span className={`tip${i > datos.length * 0.66 ? ' left' : i < datos.length * 0.33 ? ' right' : ''}`} role="tooltip">
                        <strong>{d.largo}</strong>
                        <span>
                          {d.value ?? '—'} {d.value !== null && unidad}
                        </span>
                        <span className="muted">{d.detalle}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="chart-x" aria-hidden>
              {datos.map((d) => (
                <span key={d.key}>{d.label}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  )
}

export function Estadisticas({ ordenes }: { ordenes: Orden[] }) {
  const anios = useMemo(() => {
    const s = new Set<string>()
    ordenes.forEach((o) => {
      if (o.fecha_orden) s.add(o.fecha_orden.slice(0, 4))
      if (o.fecha_cierre) s.add(o.fecha_cierre.slice(0, 4))
    })
    return [...s].sort().reverse()
  }, [ordenes])
  const [anio, setAnio] = useState<string>(() => anios[0] ?? String(new Date().getFullYear()))

  const porAnio = useMemo(
    () =>
      anios.map((y) => {
        const recibidas = ordenes.filter((o) => o.fecha_orden?.startsWith(y)).length
        const cierres = ordenes.filter((o) => o.fecha_cierre?.startsWith(y))
        return { y, recibidas, cerradas: cierres.length, media: media(cierres.map(duracion).filter((d): d is number => d !== null)) }
      }),
    [ordenes, anios],
  )
  const maxRec = Math.max(...porAnio.map((a) => a.recibidas), 1)

  const meses = useMemo(
    () =>
      MESES.map((m, i) => {
        const k = `${anio}-${String(i + 1).padStart(2, '0')}`
        const recibidas = ordenes.filter((o) => o.fecha_orden?.startsWith(k)).length
        const cierres = ordenes.filter((o) => o.fecha_cierre?.startsWith(k))
        const ds = cierres.map(duracion).filter((d): d is number => d !== null)
        return { k, m, largo: `${MESES_L[i]} ${anio}`, recibidas, cerradas: cierres.length, media: media(ds) }
      }),
    [ordenes, anio],
  )

  const kpi = porAnio.find((a) => a.y === anio)
  const abiertas = ordenes.filter((o) => o.estado !== 'FINALIZADA').length
  const dentro9 = useMemo(() => {
    const cs = ordenes.filter((o) => o.fecha_cierre?.startsWith(anio) && o.fecha_primera_actuacion)
    if (!cs.length) return null
    const ok = cs.filter((o) => cerradaDentroDe9Meses(o.fecha_primera_actuacion!, o.fecha_cierre!)).length
    return Math.round((ok / cs.length) * 100)
  }, [ordenes, anio])

  return (
    <div className="stats-page">

      <div className="chips year-chips" role="radiogroup" aria-label="Año">
        {anios.map((y) => (
          <button key={y} role="radio" aria-checked={anio === y} className={`chip${anio === y ? ' on' : ''}`} onClick={() => setAnio(y)}>
            {anio === y && <span className="icon">check</span>}
            {y}
          </button>
        ))}
      </div>

      <div className="stats kpis">
        <div className="stat s-curso">
          <div className="row">
            <span className="n">{kpi?.recibidas ?? 0}</span>
            <span className="icon fill">inbox</span>
          </div>
          <span className="label-l">Recibidas en {anio}</span>
        </div>
        <div className="stat s-fin">
          <div className="row">
            <span className="n">{kpi?.cerradas ?? 0}</span>
            <span className="icon fill">task_alt</span>
          </div>
          <span className="label-l">Cerradas en {anio}</span>
        </div>
        <div className="stat s-pte">
          <div className="row">
            <span className="n">
              {kpi?.media ?? '—'}
              {kpi?.media != null && <small> d</small>}
            </span>
            <span className="icon fill">timer</span>
          </div>
          <span className="label-l">Media para cerrar</span>
        </div>
        <div className="stat s-urg">
          <div className="row">
            <span className="n">
              {dentro9 ?? '—'}
              {dentro9 != null && <small>%</small>}
            </span>
            <span className="icon fill">verified</span>
          </div>
          <span className="label-l">Cerradas en plazo de 9 meses</span>
        </div>
      </div>

      <section className="sp-card">
        <h2 className="title-l">Media de días para cerrar, por mes</h2>
        <p className="body-m muted sp-sub">Desde la fecha de la orden hasta el cierre · {anio}</p>
        <Barras
          titulo={`Media de días para cerrar por mes en ${anio}`}
          color="var(--bar-fin)"
          unidad="días de media"
          vacio="No hay cierres registrados en este año."
          datos={meses.map((m) => ({
            key: m.k,
            label: m.m,
            largo: m.largo,
            value: m.media,
            detalle: m.cerradas ? `${m.cerradas} ${m.cerradas === 1 ? 'cerrada' : 'cerradas'}` : 'Sin cierres',
          }))}
        />
      </section>

      <section className="sp-card">
        <h2 className="title-l">Órdenes recibidas por mes</h2>
        <p className="body-m muted sp-sub">Según la fecha de la orden · {anio}</p>
        <Barras
          titulo={`Órdenes recibidas por mes en ${anio}`}
          color="var(--bar-curso)"
          unidad="órdenes"
          vacio="No hay órdenes recibidas en este año."
          datos={meses.map((m) => ({ key: m.k, label: m.m, largo: m.largo, value: m.recibidas, detalle: `${m.cerradas} cerradas ese mes` }))}
        />
      </section>

      <section className="sp-card">
        <h2 className="title-l">Detalle por mes · {anio}</h2>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="num">Recibidas</th>
                <th className="num">Cerradas</th>
                <th className="num">Media días</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.k} className={!m.recibidas && !m.cerradas ? 'empty-row' : ''}>
                  <td>{MESES_L[Number(m.k.slice(5)) - 1]}</td>
                  <td className="num">{m.recibidas || '—'}</td>
                  <td className="num">{m.cerradas || '—'}</td>
                  <td className="num">{m.media ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sp-card">
        <h2 className="title-l">Totales por año</h2>
        <ul className="years">
          {porAnio.map((a) => (
            <li key={a.y}>
              <button className={`year-row${a.y === anio ? ' on' : ''}`} onClick={() => setAnio(a.y)}>
                <span className="yr">{a.y}</span>
                <span className="yr-bar">
                  <span style={{ width: `${(a.recibidas / maxRec) * 100}%` }} />
                </span>
                <span className="yr-n">{a.recibidas}</span>
                <span className="yr-meta">
                  {a.cerradas} cerradas · {a.media != null ? `${a.media} d de media` : 'sin media'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="body-m muted sp-note">
        <span className="icon">info</span>
        Las órdenes que vinieron del Excel no tenían fecha de cierre: se usa la fecha de la última actuación. Las nuevas guardan la fecha
        real al marcarlas como finalizadas. Ahora mismo hay {abiertas} abiertas.
      </p>
    </div>
  )
}
