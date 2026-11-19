// Vista «Plazos»: todas las fechas límite en orden, agrupadas por semana, con filtros.
// Hecha a mano (no FullCalendar) para que se lea bien en el móvil.
import { useMemo } from 'react'
import { usePlazosCtx } from '../../hooks'
import { fmt, nombreDia, nombreMesCorto, parse } from '../../lib/fechas'
import type { Orden } from '../../lib/ordenes'
import { agruparPlazos, lineasPlazos, type LineaPlazo } from '../../lib/plazos/lista'
import { NIVELES, NOMBRE_NIVEL, type Nivel } from '../../lib/plazos/motor'
import { ESTADO_CLASE } from '../OrdenCard'
import { textoInhabil } from '../../lib/habiles'
import { MarcaInhabil } from '../plazos'

const ICONO_NIVEL: Record<Nivel, string> = { vencido: 'error', urgente: 'warning', medio: 'schedule', ok: 'check_circle' }

function textoQuedan(d: number) {
  if (d < 0) return `Vencido hace ${-d} ${d === -1 ? 'día' : 'días'}`
  if (d === 0) return 'Vence hoy'
  if (d === 1) return 'Mañana'
  return `Quedan ${d} días`
}

export function VistaPlazos({
  ordenes,
  ordenId,
  reglasSel,
  setReglasSel,
  nivelesSel,
  setNivelesSel,
  onOpen,
  onQuitarOrden,
  sinFiltroOrden,
}: {
  ordenes: Orden[]
  ordenId?: string
  reglasSel: string[]
  setReglasSel: (v: string[]) => void
  nivelesSel: Nivel[]
  setNivelesSel: (v: Nivel[]) => void
  onOpen: (o: Orden) => void
  onQuitarOrden: () => void
  /** El aviso «Solo la orden…» ya lo pone la pantalla del calendario */
  sinFiltroOrden?: boolean
}) {
  const ctx = usePlazosCtx()
  const reglasActivas = ctx.reglas.filter((r) => r.activa)
  // Si una regla elegida ya no existe (se borró en Ajustes), se ignora
  const reglasValidas = reglasSel.filter((id) => reglasActivas.some((r) => r.id === id))
  const todas = useMemo(() => lineasPlazos(ordenes, ctx, { ordenId }), [ordenes, ctx, ordenId])
  const lineas = useMemo(
    () =>
      todas.filter((l) => (!reglasValidas.length || reglasValidas.includes(l.plazo.regla.id)) && (!nivelesSel.length || nivelesSel.includes(l.plazo.nivel))),
    [todas, reglasValidas, nivelesSel],
  )
  const grupos = useMemo(() => agruparPlazos(lineas, ctx.hoy), [lineas, ctx.hoy])
  const cuenta = (n: Nivel) => todas.filter((l) => l.plazo.nivel === n && (!reglasValidas.length || reglasValidas.includes(l.plazo.regla.id))).length
  const ordenFiltrada = ordenId ? ordenes.find((o) => o.id === ordenId) : undefined

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])

  return (
    <div className="vplazos">
      {ordenId && !sinFiltroOrden && (
        <div className="filtro-orden" role="status">
          <span className="icon">filter_alt</span>
          <span>
            {ordenFiltrada ? (
              <>
                Solo la orden <strong className="mono">{ordenFiltrada.num_orden}</strong> · {ordenFiltrada.empresa}
              </>
            ) : (
              'No se encuentra esta orden.'
            )}
          </span>
          <button className="btn text sm" onClick={onQuitarOrden}>
            <span className="icon">close</span>
            Ver todas
          </button>
        </div>
      )}

      <div className="chips" role="group" aria-label="Filtrar por nivel">
        {NIVELES.map((n) => {
          const on = nivelesSel.includes(n)
          return (
            <button key={n} className={`chip n-${n}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setNivelesSel(alternar(nivelesSel, n))}>
              <span className="icon fill">{on ? 'check' : ICONO_NIVEL[n]}</span>
              {NOMBRE_NIVEL[n]}
              <span className="chip-n">{cuenta(n)}</span>
            </button>
          )
        })}
      </div>
      {reglasActivas.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrar por tipo de plazo">
          {reglasActivas.map((r) => {
            const on = reglasValidas.includes(r.id)
            return (
              <button key={r.id} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => setReglasSel(alternar(reglasValidas, r.id))}>
                {on && <span className="icon">check</span>}
                {r.nombre}
              </button>
            )
          })}
        </div>
      )}

      {grupos.length === 0 ? (
        <div className="empty">
          <div className="blob">
            <span className="icon">event_available</span>
          </div>
          <h2 className="headline" style={{ color: 'var(--on-surface)' }}>
            No hay plazos que mostrar
          </h2>
          <p className="body-m">{todas.length ? 'Prueba a quitar algún filtro.' : 'Ninguna orden activa tiene fechas límite con estos filtros.'}</p>
        </div>
      ) : (
        <>
          {ordenFiltrada?.estado === 'FINALIZADA' && <p className="body-m muted">Esta orden está finalizada: ya no tiene plazos que vigilar.</p>}
          {grupos.map((g) => (
            <section key={g.id} className={`pgrupo${g.id === 'vencidos' ? ' venc' : ''}`} aria-labelledby={`g-${g.id}`}>
              <h2 id={`g-${g.id}`} className="pgrupo-t">
                {g.titulo}
                <span className="pgrupo-n">{g.lineas.length}</span>
              </h2>
              <ul className="plist">
                {g.lineas.map((l) => (
                  <LineaItem key={`${l.orden.id}-${l.plazo.regla.id}`} l={l} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}

function LineaItem({ l, onOpen }: { l: LineaPlazo; onOpen: (o: Orden) => void }) {
  const { orden: o, plazo: p } = l
  const d = parse(p.fecha)
  return (
    <li>
      <button
        className={`pline n-${p.nivel}`}
        onClick={() => onOpen(o)}
        aria-label={`${p.regla.nombre} de ${o.empresa}, orden ${o.num_orden}: ${fmt(p.fecha)}, ${textoQuedan(p.dias)}${p.inhabil ? '. ' + textoInhabil(p.inhabil) : ''}`}
      >
        <span className="pfecha" aria-hidden>
          <span className="pf-dia">{nombreDia(p.fecha)}</span>
          <span className="pf-num">{d.getDate()}</span>
          <span className="pf-mes">{nombreMesCorto(p.fecha)}</span>
        </span>
        <span className="pcuerpo">
          <span className="pemp">{o.empresa}</span>
          <span className="psub">
            <span className="mono">{o.num_orden}</span>
            <span className={`badge sm ${ESTADO_CLASE[o.estado]}`}>{p.regla.nombre}</span>
          </span>
          {p.inhabil && <MarcaInhabil inhabil={p.inhabil} conTexto />}
        </span>
        <span className={`psemaforo n-${p.nivel}`}>
          <span className="icon fill" aria-hidden>
            {ICONO_NIVEL[p.nivel]}
          </span>
          <span className="pq">{textoQuedan(p.dias)}</span>
        </span>
      </button>
    </li>
  )
}
