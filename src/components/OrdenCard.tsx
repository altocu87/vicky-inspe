import { LABELS, fmt, plazo9Meses, plazoSiguiente, type Orden } from '../lib/ordenes'
import { Plazo } from './Plazo'

export const ESTADO_CLASE: Record<string, string> = {
  'SIN EMPEZAR': 'e-sin',
  'EN CURSO': 'e-curso',
  FINALIZADA: 'e-fin',
}
export const ESTADO_ICONO: Record<string, string> = {
  'SIN EMPEZAR': 'radio_button_unchecked',
  'EN CURSO': 'progress_activity',
  FINALIZADA: 'task_alt',
}

export function OrdenCard({ orden, onOpen, index }: { orden: Orden; onOpen: () => void; index: number }) {
  const fin = orden.estado === 'FINALIZADA'
  return (
    <button
      className={`card${fin ? ' finalizada' : ''}`}
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
      aria-label={`Abrir orden ${orden.num_orden} de ${orden.empresa}`}
    >
      <div className="card-head">
        <div>
          <span className="label-m mono muted">{orden.num_orden}</span>
          <h3 className="empresa">{orden.empresa}</h3>
        </div>
        <span className={`badge ${ESTADO_CLASE[orden.estado]}`}>
          <span className="icon">{ESTADO_ICONO[orden.estado]}</span>
          {LABELS[orden.estado]}
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
            {LABELS[orden.estado_docum]}
          </span>
        )}
        {orden.estado_visita && (
          <span className="badge">
            <span className="icon">location_on</span>
            {LABELS[orden.estado_visita]}
          </span>
        )}
        {orden.fecha_proxima_visita && (
          <span className="badge">
            <span className="icon">event</span>
            {fmt(orden.fecha_proxima_visita)}
          </span>
        )}
      </div>

      {orden.tareas_pendientes && (
        <p className="tasks body-m">
          <strong>Pendiente:</strong> {orden.tareas_pendientes}
        </p>
      )}
    </button>
  )
}
