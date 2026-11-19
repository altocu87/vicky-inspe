// Ficha rápida de una visita/cita o de una tarea (al pulsarla en el calendario).
// En el móvil sale como hoja desde abajo, con botones grandes: Cómo llegar, Llamar, Hecha y Fallida.
import { enlaceMapa, enlaceTel, esquemaPermitido, NOMBRE_ESTADO_EVENTO, textoHora, type Evento, type TipoCita } from '../../lib/eventos'
import { fmt, nombreDia } from '../../lib/fechas'
import { nombreRepeticion } from '../../lib/repeticionTexto'
import { NOMBRE_PRIORIDAD, NOMBRE_REPETICION, type Tarea } from '../../lib/tareas'
import type { Orden } from '../../lib/ordenes'
import { Dialogo } from './piezas'

/** Enlace externo seguro: solo https: y tel:, sin mandar de dónde vienes */
function EnlaceExterno({ href, icono, texto, clase = 'btn tonal' }: { href: string | null; icono: string; texto: string; clase?: string }) {
  if (!href || !esquemaPermitido(href)) return null
  const tel = href.startsWith('tel:')
  return (
    <a className={clase} href={href} target={tel ? undefined : '_blank'} rel="noopener noreferrer">
      <span className="icon">{icono}</span>
      {texto}
    </a>
  )
}

export function FichaEvento({
  evento: e,
  fecha,
  orden,
  tipo,
  onClose,
  onEditar,
  onDuplicar,
  onEliminar,
  onAbrirOrden,
  onMarcar,
}: {
  evento: Evento
  fecha: string
  orden?: Orden
  tipo?: TipoCita
  onClose: () => void
  onEditar: () => void
  onDuplicar: () => void
  onEliminar: () => void
  onAbrirOrden?: () => void
  onMarcar: (r: 'hecha' | 'fallida' | 'pendiente') => void
}) {
  const mapa = enlaceMapa(e.ubicacion)
  const tel = enlaceTel(e.telefono)
  const pend = e.estado === 'pendiente'
  return (
    <Dialogo hoja pequeno onClose={onClose} titulo={orden ? orden.empresa : e.titulo}>
      <div className="ficha">
        <p className="ficha-tipo">
          <span className="icon">{tipo?.icono ?? 'event'}</span>
          {tipo?.nombre ?? e.tipo}
          {orden && <span className="mono muted"> · {orden.num_orden}</span>}
          <span className={`tag est-${e.estado}`}>{NOMBRE_ESTADO_EVENTO[e.estado]}</span>
        </p>
        <p className="ficha-linea">
          <span className="icon">schedule</span>
          <span>
            {nombreDia(fecha)} {fmt(fecha)}
            {e.fecha_fin && !e.rrule ? ` – ${fmt(e.fecha_fin)}` : ''} · {textoHora(e)}
          </span>
        </p>
        {e.rrule && (
          <p className="ficha-linea">
            <span className="icon">repeat</span>
            {nombreRepeticion(e.rrule)}
          </p>
        )}
        {orden && e.titulo !== 'Visita' && (
          <p className="ficha-linea">
            <span className="icon">title</span>
            {e.titulo}
          </p>
        )}
        {e.ubicacion && (
          <p className="ficha-linea">
            <span className="icon">location_on</span>
            {e.ubicacion}
          </p>
        )}
        {e.telefono && (
          <p className="ficha-linea">
            <span className="icon">call</span>
            {e.telefono}
          </p>
        )}
        {e.notas && <p className="ficha-notas body-m">{e.notas}</p>}

        {(mapa || tel) && (
          <div className="ficha-botones grandes">
            <EnlaceExterno href={mapa} icono="directions" texto="Cómo llegar" clase="btn filled" />
            <EnlaceExterno href={tel} icono="call" texto="Llamar" />
          </div>
        )}
        <div className="ficha-botones grandes">
          {pend ? (
            <>
              <button className="btn tonal ok" onClick={() => onMarcar('hecha')}>
                <span className="icon">check_circle</span>
                Hecha
              </button>
              <button className="btn tonal ko" onClick={() => onMarcar('fallida')}>
                <span className="icon">cancel</span>
                Fallida
              </button>
            </>
          ) : (
            <button className="btn tonal" onClick={() => onMarcar('pendiente')}>
              <span className="icon">undo</span>
              Volver a pendiente
            </button>
          )}
        </div>
        <div className="ficha-botones">
          <button className="btn text" onClick={onEditar}>
            <span className="icon">edit</span>
            Editar
          </button>
          <button className="btn text" onClick={onDuplicar}>
            <span className="icon">content_copy</span>
            Duplicar
          </button>
          {onAbrirOrden && (
            <button className="btn text" onClick={onAbrirOrden}>
              <span className="icon">open_in_new</span>
              Abrir la orden
            </button>
          )}
          <button className="btn danger-text" onClick={onEliminar}>
            <span className="icon">delete</span>
            Eliminar
          </button>
        </div>
      </div>
    </Dialogo>
  )
}

export function FichaTarea({
  tarea: t,
  orden,
  onClose,
  onEditar,
  onEliminar,
  onAlternar,
  onAbrirOrden,
}: {
  tarea: Tarea
  orden?: Orden
  onClose: () => void
  onEditar: () => void
  onEliminar: () => void
  onAlternar: () => void
  onAbrirOrden?: () => void
}) {
  return (
    <Dialogo hoja pequeno onClose={onClose} titulo={t.titulo}>
      <div className="ficha">
        <p className="ficha-tipo">
          <span className="icon">task_alt</span>
          Tarea · prioridad {NOMBRE_PRIORIDAD[t.prioridad].toLowerCase()}
          {t.oficina && <span className="tag">Oficina</span>}
        </p>
        {orden && (
          <p className="ficha-linea">
            <span className="icon">link</span>
            {orden.empresa} <span className="mono muted">{orden.num_orden}</span>
          </p>
        )}
        <p className="ficha-linea">
          <span className="icon">event</span>
          {t.vence ? `${nombreDia(t.vence)} ${fmt(t.vence)}${t.hora ? ' · ' + t.hora : ''}` : 'Sin fecha (por programar)'}
        </p>
        {t.repeticion !== 'no' && (
          <p className="ficha-linea">
            <span className="icon">repeat</span>
            {NOMBRE_REPETICION[t.repeticion]}
          </p>
        )}
        {t.notas && <p className="ficha-notas body-m">{t.notas}</p>}
        <div className="ficha-botones grandes">
          <button className={`btn ${t.hecha ? 'tonal' : 'filled'}`} onClick={onAlternar}>
            <span className="icon">{t.hecha ? 'undo' : 'check'}</span>
            {t.hecha ? 'Marcar como no hecha' : t.repeticion !== 'no' ? 'Hecha (pasa a la siguiente)' : 'Hecha'}
          </button>
        </div>
        <div className="ficha-botones">
          <button className="btn text" onClick={onEditar}>
            <span className="icon">edit</span>
            Editar
          </button>
          {onAbrirOrden && (
            <button className="btn text" onClick={onAbrirOrden}>
              <span className="icon">open_in_new</span>
              Abrir la orden
            </button>
          )}
          <button className="btn danger-text" onClick={onEliminar}>
            <span className="icon">delete</span>
            Eliminar
          </button>
        </div>
      </div>
    </Dialogo>
  )
}
