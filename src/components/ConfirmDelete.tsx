import { useEffect, useRef } from 'react'
import type { Orden } from '../lib/ordenes'

export function ConfirmDelete({ orden, onCancel, onConfirm }: { orden: Orden; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="small"
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      aria-labelledby="del-title"
    >
      <div className="dlg">
        <div className="dlg-body" style={{ paddingTop: 24, alignItems: 'center', textAlign: 'center' }}>
          <span className="icon" style={{ fontSize: 32, color: 'var(--error)' }}>
            delete
          </span>
          <h2 id="del-title" className="headline">
            ¿Eliminar esta orden?
          </h2>
          <p className="body-m muted" style={{ margin: 0 }}>
            Se eliminará la orden <strong className="mono">{orden.num_orden}</strong> de <strong>{orden.empresa}</strong>
            , con sus visitas, citas y tareas.
            <br />
            Podrás deshacerlo durante unos segundos, pero <strong>su historial de cambios se borra y no se puede recuperar</strong>.
          </p>
        </div>
        <div className="dlg-foot" style={{ borderTop: 0, justifyContent: 'flex-end' }}>
          <button className="btn text" onClick={onCancel} autoFocus>
            Cancelar
          </button>
          <button className="btn danger" onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </dialog>
  )
}
