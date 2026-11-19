// Panel «Por programar»: órdenes con prisa y sin visita, y tareas sin fecha.
// En el ordenador se arrastran al calendario; en todas partes hay un botón «Programar».
import { forwardRef } from 'react'
import { fmtCorta } from '../../lib/fechas'
import { textoDias } from '../../lib/ordenes'
import { NOMBRE_PRIORIDAD } from '../../lib/tareas'
import type { ItemPorProgramar } from '../../lib/porProgramar'
import { useAcciones } from '../../state/acciones'

export const PanelPorProgramar = forwardRef<HTMLDivElement, { items: readonly ItemPorProgramar[]; arrastrable: boolean; hoy: string }>(function PanelPorProgramar(
  { items, arrastrable, hoy },
  ref,
) {
  const { programarVisita, editarTarea, abrirOrden } = useAcciones()
  return (
    <div className="pp" ref={ref}>
      <p className="body-m muted pp-ayuda">
        {arrastrable ? 'Arrástralas a un día del calendario o pulsa «Programar».' : 'Pulsa «Programar» para darles día.'} Órdenes con un plazo a menos de 30
        días y sin visita, y tareas sin fecha.
      </p>
      {items.length === 0 ? (
        <p className="body-m muted">¡Nada pendiente de programar!</p>
      ) : (
        <ul className="pp-lista">
          {items.map((it) =>
            it.tipo === 'orden' ? (
              <li
                key={it.orden.id}
                className={`pp-item n-${it.plazo.nivel}`}
                data-pp="orden"
                data-id={it.orden.id}
                data-titulo={it.orden.empresa}
              >
                <button className="pp-txt" onClick={() => abrirOrden(it.orden.id)} title="Abrir la orden">
                  <span className="pp-tit">{it.orden.empresa}</span>
                  <span className="pp-det">
                    <span className="mono">{it.orden.num_orden}</span> · {it.plazo.regla.corto} {fmtCorta(it.plazo.fecha)} ·{' '}
                    <strong>{textoDias(it.plazo.dias)}</strong>
                  </span>
                </button>
                <button className="btn tonal sm pp-btn" onClick={() => programarVisita(it.orden.id)}>
                  <span className="icon">event_available</span>
                  Programar
                </button>
              </li>
            ) : (
              <li key={it.tarea.id} className={`pp-item t-${it.tarea.prioridad}`} data-pp="tarea" data-id={it.tarea.id} data-titulo={it.tarea.titulo}>
                <button className="pp-txt" onClick={() => editarTarea(it.tarea)}>
                  <span className="pp-tit">
                    <span className="icon">task_alt</span> {it.tarea.titulo}
                  </span>
                  <span className="pp-det">Tarea · prioridad {NOMBRE_PRIORIDAD[it.tarea.prioridad].toLowerCase()}</span>
                </button>
                <button className="btn tonal sm pp-btn" onClick={() => editarTarea({ ...it.tarea, vence: hoy })}>
                  <span className="icon">event</span>
                  Programar
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
})
