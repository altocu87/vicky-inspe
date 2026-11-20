// Piezas pequeñas para mostrar plazos en varias pantallas.
import { textoInhabil, type Inhabil } from '../lib/habiles'
import type { Orden } from '../lib/ordenes'
import { irA } from '../nav'
import { useAcciones } from '../state/acciones'

/** Icono que avisa de que el plazo cae en sábado, domingo o festivo */
export function MarcaInhabil({ inhabil, conTexto }: { inhabil: Inhabil | null; conTexto?: boolean }) {
  if (!inhabil) return null
  const t = textoInhabil(inhabil)
  return (
    <span className="inhabil" title={t}>
      <span className="icon" aria-hidden>
        {inhabil.motivo === 'festivo' ? 'celebration' : 'weekend'}
      </span>
      {conTexto ? <span>{t}</span> : <span className="sr-only">{t}</span>}
    </span>
  )
}

/** Abre el calendario filtrado a una orden */
export function BotonVerCalendario({ orden, className = '' }: { orden: Pick<Orden, 'id' | 'num_orden'>; className?: string }) {
  return (
    <button
      type="button"
      className={`icon-btn ver-cal ${className}`}
      title="Ver en el calendario"
      aria-label={`Ver la orden ${orden.num_orden} en el calendario`}
      onClick={(e) => {
        e.stopPropagation()
        irA({ pantalla: 'calendario', vista: 'plazos', orden: orden.id })
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="icon">event_upcoming</span>
    </button>
  )
}

/** «Programar visita»: abre el formulario de visita de la orden con el próximo domingo o lunes libre */
export function BotonProgramar({ orden, className = '' }: { orden: Pick<Orden, 'id' | 'num_orden'>; className?: string }) {
  const { programarVisita } = useAcciones()
  return (
    <button
      type="button"
      className={`icon-btn ver-cal ${className}`}
      title="Programar visita"
      data-tour="programar"
      aria-label={`Programar una visita para la orden ${orden.num_orden}`}
      onClick={(e) => {
        e.stopPropagation()
        programarVisita(orden.id)
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="icon">add_location_alt</span>
    </button>
  )
}
