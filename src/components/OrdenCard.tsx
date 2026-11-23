import { usePlazosCtx } from '../hooks'
import { fmt, label, type Orden } from '../lib/ordenes'
import { plazosDe } from '../lib/plazos/motor'
import { Plazo } from './Plazo'
import { BotonVerCalendario } from './plazos'
import { ESTADO_CLASE, ESTADO_ICONO } from './estados'
import { MarcaRepetida } from './NumOrden'

export function OrdenCard({ orden, onOpen, index }: { orden: Orden; onOpen: () => void; index: number }) {
  const fin = orden.estado === 'FINALIZADA'
  const ctx = usePlazosCtx()
  const plazos = plazosDe(orden, ctx)
  // Las dos del Excel siempre (aunque estén vacías); las añadidas en Ajustes, si aplican
  // Si la regla está desactivada en Ajustes no se muestra su fecha
  const lim9 = plazos.find((p) => p.regla.id === 'lim9' && p.regla.activa) ?? null
  const sig = plazos.find((p) => p.regla.id === 'sig' && p.regla.activa) ?? null
  const apagada = (id: string) => ctx.reglas.find((r) => r.id === id)?.activa === false
  const otros = plazos.filter((p) => p.regla.id !== 'lim9' && p.regla.id !== 'sig' && p.regla.activa && (p.aplica || fin))
  return (
    <div className="card-wrap">
      <button
        className={`card ${ESTADO_CLASE[orden.estado]}${fin ? ' finalizada' : ''}`}
        onClick={onOpen}
        style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
        aria-label={`Abrir orden ${orden.num_orden} de ${orden.empresa}`}
      >
        <div className="card-head">
          <div>
            <span className="label-m mono muted">
              {orden.num_orden} <MarcaRepetida id={orden.id} num={orden.num_orden} /> · {fmt(orden.fecha_orden)}
            </span>
            <h3 className="empresa">{orden.empresa}</h3>
          </div>
          <span className={`badge ${ESTADO_CLASE[orden.estado]}`}>
            <span className="icon">{ESTADO_ICONO[orden.estado]}</span>
            {label(orden.estado)}
          </span>
        </div>

        <div className="plazos">
          <Plazo titulo="Límite 9 meses" plazo={lim9} inhabil={lim9?.inhabil} finalizada={fin} vacio={apagada('lim9') ? 'Regla desactivada' : 'Sin primera actuación'} />
          <Plazo titulo="Siguiente actuación" plazo={sig} inhabil={sig?.inhabil} finalizada={fin} vacio={apagada('sig') ? 'Regla desactivada' : 'Sin última actuación'} />
          {otros.map((p) => (
            <Plazo key={p.regla.id} titulo={p.regla.nombre} plazo={p} inhabil={p.inhabil} finalizada={fin} vacio="" />
          ))}
        </div>

        <div className="meta">
          {orden.estado_docum && (
            <span className="badge">
              <span className="icon">description</span>
              {label(orden.estado_docum)}
            </span>
          )}
          {orden.estado_visita && (
            <span className="badge">
              <span className="icon">location_on</span>
              {label(orden.estado_visita)}
            </span>
          )}
        </div>

        {orden.tareas_pendientes && (
          <p className="tasks body-m">
            <strong>Tareas:</strong> {orden.tareas_pendientes}
          </p>
        )}
      </button>
      <BotonVerCalendario orden={orden} className="card-cal" />
    </div>
  )
}
