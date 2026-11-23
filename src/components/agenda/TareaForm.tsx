// Formulario de una tarea (nueva o para editar).
import { useState } from 'react'
import { esIso, fmt, hoyIso, nombreDia } from '../../lib/fechas'
import { cambiosAlHacer, NOMBRE_PRIORIDAD, NOMBRE_REPETICION, PRIORIDADES, REPETICIONES, type TareaInput } from '../../lib/tareas'
import { proximoLunes } from '../../lib/semana'
import type { Orden } from '../../lib/ordenes'
import { Dialogo, Interruptor, Opciones, SelectorOrden } from './piezas'

export function TareaForm({
  inicial,
  id,
  ordenes,
  onClose,
  onGuardar,
  onEliminar,
}: {
  inicial: TareaInput
  id?: string
  ordenes: readonly Orden[]
  onClose: () => void
  onGuardar: (t: TareaInput) => Promise<boolean>
  onEliminar?: () => void
}) {
  const [f, setF] = useState<TareaInput>(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof TareaInput>(k: K, v: TareaInput[K]) => setF((p) => ({ ...p, [k]: v }))

  // ¿Se acaba de marcar como hecha una tarea que se repite? (al guardar pasará a la siguiente fecha)
  const seRepiteYSeMarca = (t: TareaInput) => !!id && t.hecha && !inicial.hecha && !!t.vence && t.repeticion !== 'no'

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const titulo = f.titulo.trim()
    if (!titulo) return setError('Escribe qué hay que hacer')
    if (f.vence && !esIso(f.vence)) return setError('La fecha no es válida')
    const dur = f.duracion_min
    if (dur !== null && (!Number.isInteger(dur) || dur < 5 || dur > 1440)) return setError('La duración debe ser de 5 a 1440 minutos')
    setError(null)
    const limpio: TareaInput = {
      ...f,
      titulo,
      notas: f.notas?.trim() || null,
      hora: f.vence ? f.hora || null : null,
      duracion_min: f.vence && f.hora ? dur : null,
      repeticion: f.vence ? f.repeticion : 'no',
    }
    // Una tarea que se repite no se cierra al marcarla: pasa a la siguiente fecha (como en la lista).
    const final = seRepiteYSeMarca(limpio) ? { ...limpio, ...cambiosAlHacer({ ...limpio, id: id! }, hoyIso()) } : limpio
    setGuardando(true)
    try {
      const ok = await onGuardar(final)
      if (ok) onClose()
    } catch {
      setError('No se pudo guardar: no hay conexión con el servidor. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      titulo={id ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      pie={
        <>
          {id && onEliminar && (
            <button type="button" className="btn danger-text" onClick={onEliminar}>
              <span className="icon">delete</span>
              Eliminar
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn text hide-mobile" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="form-tarea" className="btn filled" disabled={guardando}>
            <span className="icon">{guardando ? 'hourglass_top' : 'save'}</span>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="form-tarea" className="agenda-form" onSubmit={guardar} noValidate>
        <div className="field">
          <label htmlFor="ta-titulo">Qué hay que hacer *</label>
          <input id="ta-titulo" value={f.titulo} maxLength={200} onChange={(e) => set('titulo', e.target.value)} autoFocus={!id} />
        </div>
        <SelectorOrden id="ta-orden" ordenes={ordenes} valor={f.orden_id} onChange={(v) => set('orden_id', v)} />
        <Interruptor label="Para la oficina (lunes)" checked={f.oficina} onChange={(v) => set('oficina', v)} />
        <div className="fields">
          <div className="field">
            <label htmlFor="ta-vence">Fecha (vacía = «Por programar»)</label>
            <input id="ta-vence" type="date" value={f.vence ?? ''} onChange={(e) => set('vence', e.target.value || null)} />
            {f.vence && esIso(f.vence) && (
              <span className="help">
                {nombreDia(f.vence)} {fmt(f.vence)}
              </span>
            )}
          </div>
          <button type="button" className="btn tonal atajo" onClick={() => setF((p) => ({ ...p, vence: proximoLunes(hoyIso()), oficina: true }))}>
            <span className="icon">work</span>
            Próximo lunes (oficina)
          </button>
        </div>
        {f.vence && (
          <div className="fields">
            <div className="field">
              <label htmlFor="ta-hora">Hora (opcional)</label>
              <input id="ta-hora" type="time" value={f.hora ?? ''} onChange={(e) => set('hora', e.target.value || null)} />
            </div>
            {f.hora && (
              <div className="field">
                <label htmlFor="ta-dur">Duración (minutos)</label>
                <input
                  id="ta-dur"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={1440}
                  step={5}
                  value={f.duracion_min ?? ''}
                  onChange={(e) => set('duracion_min', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="ta-rep">Repetir</label>
              <select id="ta-rep" value={f.repeticion} onChange={(e) => set('repeticion', e.target.value as TareaInput['repeticion'])}>
                {REPETICIONES.map((r) => (
                  <option key={r} value={r}>
                    {NOMBRE_REPETICION[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        <Opciones label="Prioridad" opciones={PRIORIDADES} valor={f.prioridad} onChange={(v) => set('prioridad', v)} nombres={NOMBRE_PRIORIDAD} />
        <div className="field">
          <label htmlFor="ta-notas">Notas</label>
          <textarea id="ta-notas" rows={3} value={f.notas ?? ''} maxLength={4000} onChange={(e) => set('notas', e.target.value)} />
        </div>
        {id && <Interruptor label="Hecha" checked={f.hecha} onChange={(v) => setF((p) => ({ ...p, hecha: v, hecha_el: v ? hoyIso() : null }))} />}
        {seRepiteYSeMarca(f) && esIso(f.vence) && (
          <p className="aviso-caja">
            <span className="icon">event_repeat</span> Se repite: al guardar no se cierra, pasa a la siguiente fecha ({fmt(cambiosAlHacer({ ...f, id: id! }, hoyIso()).vence!)}).
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            <span className="icon">error</span>
            {error}
          </p>
        )}
      </form>
    </Dialogo>
  )
}
