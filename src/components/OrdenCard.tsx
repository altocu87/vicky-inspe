import { fmt, label, plazo9Meses, plazoSiguiente, type Orden } from '../lib/ordenes'
import { Plazo } from './Plazo'

export const ESTADO_CLASE: Record<string, string> = {
  'EN CURSO': 'e-curso',
  'PTE ENTREGA': 'e-pte',
  FINALIZADA: 'e-fin',
}
export const ESTADO_ICONO: Record<string, string> = {
  'EN CURSO': 'progress_activity',
  'PTE ENTREGA': 'hourglass_top',
  FINALIZADA: 'task_alt',
}

export function OrdenCard({ orden, onOpen, index }: { orden: Orden; onOpen: () => void; index: number }) {
  const fin = orden.estado === 'FINALIZADA'
  return (
    <button
      className={`card ${ESTADO_CLASE[orden.estado]}${fin ? ' finalizada' : ''}`}
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      aria-label={`Abrir orden ${orden.num_orden} de ${orden.empresa}`}
    >
      <div className="card-head">
        <div>
          <span className="label-m mono muted">
            {orden.num_orden} · {fmt(orden.fecha_orden)}
          </span>
          <h3 className="empresa">{orden.empresa}</h3>
        </div>
        <span className={`badge ${ESTADO_CLASE[orden.estado]}`}>
          <span className="icon">{ESTADO_ICONO[orden.estado]}</span>
          {label(orden.estado)}
        </span>
      </div>

      <div className="plazos">
        <Plazo titulo="Límite 9 meses" plazo={plazo9Meses(orden)} finalizada={fin} vacio="Sin primera actuación" />
        <Plazo titulo="Siguiente actuación" plazo={plazoSiguiente(orden)} finalizada={fin} vacio="Sin última actuación" />
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
  )
}
