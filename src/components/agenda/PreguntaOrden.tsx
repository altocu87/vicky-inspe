// Tras marcar una visita o cita como HECHA o FALLIDA: resultado, detalles de la visita
// y (si es de una orden) ¿actualizo la orden? Nunca se cambia la orden sin que ella lo confirme.
import { useState } from 'react'
import { fmt, fmtCorta } from '../../lib/fechas'
import { label, type Orden } from '../../lib/ordenes'
import { hayPropuesta, type PropuestaOrden, type Resultado } from '../../lib/visitaEstado'
import { Dialogo } from './piezas'

export function PreguntaOrden({
  titulo,
  fecha,
  notasIniciales,
  orden,
  propuesta: p,
  resultado,
  esVisita = true,
  onClose,
  onAplicar,
}: {
  esVisita?: boolean
  /** Nombre de la visita o cita */
  titulo: string
  fecha: string
  notasIniciales: string | null
  orden?: Orden
  propuesta: PropuestaOrden | null
  resultado: Resultado
  onClose: () => void
  /** Guarda los detalles (si cambian) y los cambios marcados en la orden; devuelve false si falla */
  onAplicar: (notas: string | null, cambios: Partial<Orden>) => Promise<boolean>
}) {
  const [notas, setNotas] = useState(notasIniciales ?? '')
  const [ultima, setUltima] = useState(!!p?.ultima)
  const [primera, setPrimera] = useState(!!p?.primera)
  const [estado, setEstado] = useState(!!p?.estadoVisita)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conOrden = !!(orden && p && hayPropuesta(p))

  async function aplicar() {
    const c: Partial<Orden> = {}
    if (conOrden) {
      if (ultima && p!.ultima) c.fecha_ultima_actuacion = p!.ultima.despues
      if (primera && p!.primera) c.fecha_primera_actuacion = p!.primera.despues
      if (estado && p!.estadoVisita) c.estado_visita = p!.estadoVisita.despues
    }
    const n = notas.trim() ? notas.trim().slice(0, 4000) : null
    setGuardando(true)
    setError(null)
    try {
      const ok = await onAplicar(n !== (notasIniciales ?? null) ? n : notasIniciales, c)
      if (ok) onClose()
    } catch {
      setError('No se pudo guardar: no hay conexión con el servidor. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      pequeno
      hoja
      onClose={onClose}
      titulo={`${esVisita ? 'Visita' : 'Cita'} ${resultado === 'hecha' ? 'hecha' : 'fallida'}`}
      pie={
        <>
          <button type="button" className="btn text" onClick={onClose}>
            {conOrden ? 'No cambiar nada más' : 'Cerrar'}
          </button>
          <span className="spacer" />
          <button type="button" className="btn filled" disabled={guardando} onClick={aplicar}>
            <span className="icon">save</span>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <p className={`resultado-cab ${resultado === 'hecha' ? 'ok' : 'ko'}`}>
        <span className="icon fill">{resultado === 'hecha' ? 'check_circle' : 'cancel'}</span>
        <span>
          <strong>{orden ? orden.empresa : titulo}</strong>
          {orden && <span className="mono"> · {orden.num_orden}</span>}
          <br />
          {fmt(fecha)} · {resultado === 'hecha' ? 'hecha' : 'fallida'}
        </span>
      </p>
      <div className="field">
        <label htmlFor="res-notas">Detalles de la {esVisita ? 'visita' : 'cita'} (opcional)</label>
        <textarea
          id="res-notas"
          rows={3}
          maxLength={4000}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder={resultado === 'hecha' ? 'Qué se vio, qué documentación se pidió…' : 'Por qué no se pudo: cerrado, no estaba el responsable…'}
        />
      </div>
      {conOrden && (
        <>
          <p className="body-m" style={{ margin: 0 }}>
            ¿Actualizo la orden? Marca lo que quieres cambiar:
          </p>
          <div className="pregunta-lista">
            {p!.ultima && (
              <label className="aj-check grande">
                <input type="checkbox" checked={ultima} onChange={(e) => setUltima(e.target.checked)} />
                <span>
                  Última actuación: {p!.ultima.antes ? fmtCorta(p!.ultima.antes) : '—'} → <strong>{fmt(p!.ultima.despues)}</strong>
                  <span className="help muted"> (se recalcula el plazo siguiente)</span>
                </span>
              </label>
            )}
            {p!.primera && (
              <label className="aj-check grande">
                <input type="checkbox" checked={primera} onChange={(e) => setPrimera(e.target.checked)} />
                <span>
                  1.ª actuación (estaba vacía) → <strong>{fmt(p!.primera.despues)}</strong>
                  <span className="help muted"> (empieza a contar el límite de 9 meses)</span>
                </span>
              </label>
            )}
            {p!.estadoVisita && (
              <label className="aj-check grande">
                <input type="checkbox" checked={estado} onChange={(e) => setEstado(e.target.checked)} />
                <span>
                  Estado de la visita: {label(p!.estadoVisita.antes) || '—'} → <strong>{label(p!.estadoVisita.despues)}</strong>
                </span>
              </label>
            )}
          </div>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          <span className="icon">error</span>
          {error}
        </p>
      )}
    </Dialogo>
  )
}
