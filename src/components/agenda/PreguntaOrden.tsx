// Tras marcar una visita o cita como HECHA o FALLIDA: ¿actualizo la orden?
// Nunca se cambia nada sin que ella lo confirme. Cada cambio se puede desmarcar.
import { useState } from 'react'
import { fmt, fmtCorta } from '../../lib/fechas'
import { label, type Orden } from '../../lib/ordenes'
import type { PropuestaOrden, Resultado } from '../../lib/visitaEstado'
import { Dialogo } from './piezas'

export function PreguntaOrden({
  orden,
  propuesta: p,
  resultado,
  onClose,
  onAplicar,
}: {
  orden: Orden
  propuesta: PropuestaOrden
  resultado: Resultado
  onClose: () => void
  onAplicar: (cambios: Partial<Orden>) => Promise<boolean>
}) {
  const [ultima, setUltima] = useState(!!p.ultima)
  const [primera, setPrimera] = useState(!!p.primera)
  const [estado, setEstado] = useState(!!p.estadoVisita)
  const [guardando, setGuardando] = useState(false)
  const nada = !(ultima || primera || estado)

  async function aplicar() {
    const c: Partial<Orden> = {}
    if (ultima && p.ultima) c.fecha_ultima_actuacion = p.ultima.despues
    if (primera && p.primera) c.fecha_primera_actuacion = p.primera.despues
    if (estado && p.estadoVisita) c.estado_visita = p.estadoVisita.despues
    setGuardando(true)
    const ok = await onAplicar(c)
    setGuardando(false)
    if (ok) onClose()
  }

  return (
    <Dialogo
      pequeno
      hoja
      onClose={onClose}
      titulo="¿Actualizo la orden?"
      pie={
        <>
          <button type="button" className="btn text" onClick={onClose}>
            No, déjala igual
          </button>
          <span className="spacer" />
          <button type="button" className="btn filled" disabled={nada || guardando} onClick={aplicar}>
            <span className="icon">save</span>
            Actualizar
          </button>
        </>
      }
    >
      <p className="body-m">
        La actuación de <strong>{orden.empresa}</strong> ({orden.num_orden}) ha quedado <strong>{resultado === 'hecha' ? 'hecha' : 'fallida'}</strong>. Marca
        lo que quieres cambiar en la orden:
      </p>
      <div className="pregunta-lista">
        {p.ultima && (
          <label className="aj-check grande">
            <input type="checkbox" checked={ultima} onChange={(e) => setUltima(e.target.checked)} />
            <span>
              Última actuación: {p.ultima.antes ? fmtCorta(p.ultima.antes) : '—'} → <strong>{fmt(p.ultima.despues)}</strong>
              <span className="help muted"> (se recalcula el plazo siguiente)</span>
            </span>
          </label>
        )}
        {p.primera && (
          <label className="aj-check grande">
            <input type="checkbox" checked={primera} onChange={(e) => setPrimera(e.target.checked)} />
            <span>
              1.ª actuación (estaba vacía) → <strong>{fmt(p.primera.despues)}</strong>
              <span className="help muted"> (empieza a contar el límite de 9 meses)</span>
            </span>
          </label>
        )}
        {p.estadoVisita && (
          <label className="aj-check grande">
            <input type="checkbox" checked={estado} onChange={(e) => setEstado(e.target.checked)} />
            <span>
              Estado de la visita: {label(p.estadoVisita.antes) || '—'} → <strong>{label(p.estadoVisita.despues)}</strong>
            </span>
          </label>
        )}
      </div>
    </Dialogo>
  )
}
