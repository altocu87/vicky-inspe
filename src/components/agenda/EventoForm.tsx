// Formulario de una visita o cita (nueva o para editar).
import { useState } from 'react'
import { useAgenda } from '../../state/agenda'
import { useAcciones } from '../../state/acciones'
import { esIso, fmt, nombreDia } from '../../lib/fechas'
import { ESTADOS_EVENTO, NOMBRE_ESTADO_EVENTO, telefonoValido, type EventoInput } from '../../lib/eventos'
import { conHasta, hastaDe, nombreRepeticion, REPETICIONES_EVENTO } from '../../lib/repeticion'
import { esDiaVisita } from '../../lib/semana'
import type { Orden } from '../../lib/ordenes'
import { Dialogo, Interruptor, Opciones, SelectorOrden } from './piezas'

export type ModoSerie = 'serie' | 'solo'

const AVISOS = [
  { min: 0, txt: 'A la hora' },
  { min: 30, txt: '30 min antes' },
  { min: 60, txt: '1 hora antes' },
  { min: 1440, txt: '1 día antes' },
]

export function EventoForm({
  inicial,
  id,
  ocurrencia,
  ordenes,
  onClose,
  onGuardar,
  onEliminar,
}: {
  inicial: EventoInput
  /** Si se edita uno existente */
  id?: string
  /** Si es una aparición de una serie: su día */
  ocurrencia?: string
  ordenes: readonly Orden[]
  onClose: () => void
  onGuardar: (e: EventoInput, modo: ModoSerie) => Promise<boolean>
  onEliminar?: (modo: ModoSerie) => void
}) {
  const { tipos } = useAgenda()
  const { huecoVisita } = useAcciones()
  const [f, setF] = useState<EventoInput>(() => (ocurrencia ? { ...inicial, fecha: ocurrencia, fecha_fin: null } : inicial))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof EventoInput>(k: K, v: EventoInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const deSerie = !!ocurrencia && !!inicial.rrule
  const [modo, setModo] = useState<ModoSerie>('solo')
  const tiposActivos = tipos.filter((t) => t.activo || t.id === f.tipo)
  const repId = REPETICIONES_EVENTO.find((r) => r.rrule === (f.rrule ? conHasta(f.rrule, null) : null))?.id ?? (f.rrule ? 'personal' : 'no')

  function validar(): string | null {
    if (!esIso(f.fecha)) return 'Indica la fecha'
    if (!f.todo_el_dia && !f.hora_inicio) return 'Indica la hora de inicio o marca «Todo el día»'
    if (!f.todo_el_dia && f.hora_fin && f.hora_inicio && f.hora_fin <= f.hora_inicio) return 'La hora de fin debe ser posterior a la de inicio'
    if (f.todo_el_dia && f.fecha_fin && f.fecha_fin < f.fecha) return 'El último día no puede ser anterior al primero'
    if (f.telefono && !telefonoValido(f.telefono)) return 'El teléfono solo puede tener números, espacios y «+»'
    if ((f.titulo ?? '').length > 200 || (f.ubicacion ?? '').length > 300 || (f.notas ?? '').length > 4000) return 'Algún texto es demasiado largo'
    return null
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const err = validar()
    setError(err)
    if (err) return
    const tipo = tipos.find((t) => t.id === f.tipo)
    const limpio: EventoInput = {
      ...f,
      titulo: f.titulo.trim() || tipo?.nombre || 'Cita',
      hora_inicio: f.todo_el_dia ? null : f.hora_inicio,
      hora_fin: f.todo_el_dia ? null : f.hora_fin || null,
      fecha_fin: f.todo_el_dia && f.fecha_fin && f.fecha_fin > f.fecha ? f.fecha_fin : null,
      ubicacion: f.ubicacion?.trim() || null,
      telefono: f.telefono?.trim() || null,
      notas: f.notas?.trim() || null,
    }
    setGuardando(true)
    const ok = await onGuardar(limpio, deSerie ? modo : 'serie')
    setGuardando(false)
    if (ok) onClose()
  }

  const titulo = id ? 'Editar cita' : f.tipo === 'visita' ? 'Nueva visita' : 'Nueva cita'
  return (
    <Dialogo
      titulo={titulo}
      onClose={onClose}
      pie={
        <>
          {id && onEliminar && (
            <button type="button" className="btn danger-text" onClick={() => onEliminar(deSerie ? modo : 'serie')}>
              <span className="icon">delete</span>
              Eliminar
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn text hide-mobile" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form="form-evento" className="btn filled" disabled={guardando}>
            <span className="icon">{guardando ? 'hourglass_top' : 'save'}</span>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="form-evento" className="agenda-form" onSubmit={guardar} noValidate>
        {deSerie && (
          <Opciones<ModoSerie>
            label="Se repite: ¿qué cambias?"
            opciones={['solo', 'serie']}
            valor={modo}
            onChange={setModo}
            nombres={{ solo: `Solo el ${fmt(ocurrencia!)}`, serie: 'Toda la serie' }}
          />
        )}
        <Opciones
          label="Tipo"
          opciones={tiposActivos.map((t) => t.id)}
          valor={f.tipo}
          onChange={(v) => set('tipo', v)}
          nombres={Object.fromEntries(tipos.map((t) => [t.id, t.nombre]))}
          iconos={Object.fromEntries(tipos.map((t) => [t.id, t.icono]))}
        />
        <div className="field">
          <label htmlFor="ev-titulo">Título</label>
          <input id="ev-titulo" value={f.titulo} maxLength={200} onChange={(e) => set('titulo', e.target.value)} placeholder={tipos.find((t) => t.id === f.tipo)?.nombre} />
        </div>
        <SelectorOrden id="ev-orden" ordenes={ordenes} valor={f.orden_id} onChange={(v) => set('orden_id', v)} />

        <div className="fields">
          <div className="field">
            <label htmlFor="ev-fecha">{f.todo_el_dia ? 'Primer día' : 'Día'}</label>
            <input id="ev-fecha" type="date" value={f.fecha} onChange={(e) => e.target.value && set('fecha', e.target.value)} required />
            {esIso(f.fecha) && (
              <span className="help">
                {nombreDia(f.fecha)} {fmt(f.fecha)}
                {esDiaVisita(f.fecha) ? ' · día de visitas' : ''}
              </span>
            )}
          </div>
          {f.tipo === 'visita' && (
            <button type="button" className="btn tonal atajo" onClick={() => set('fecha', huecoVisita())}>
              <span className="icon">event_available</span>
              Próximo domingo o lunes libre
            </button>
          )}
        </div>
        <Interruptor label="Todo el día" checked={f.todo_el_dia} onChange={(v) => setF((p) => ({ ...p, todo_el_dia: v, hora_inicio: v ? null : (p.hora_inicio ?? '10:00') }))} />
        {f.todo_el_dia ? (
          <div className="field">
            <label htmlFor="ev-fin">Último día (si dura varios)</label>
            <input id="ev-fin" type="date" value={f.fecha_fin ?? ''} min={f.fecha} onChange={(e) => set('fecha_fin', e.target.value || null)} />
          </div>
        ) : (
          <div className="fields">
            <div className="field">
              <label htmlFor="ev-hi">Hora de inicio</label>
              <input id="ev-hi" type="time" value={f.hora_inicio ?? ''} onChange={(e) => set('hora_inicio', e.target.value || null)} />
            </div>
            <div className="field">
              <label htmlFor="ev-hf">Hora de fin</label>
              <input id="ev-hf" type="time" value={f.hora_fin ?? ''} onChange={(e) => set('hora_fin', e.target.value || null)} />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="ev-ubi">Dirección</label>
          <input id="ev-ubi" value={f.ubicacion ?? ''} maxLength={300} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Calle, número, localidad" autoComplete="street-address" />
        </div>
        <div className="field">
          <label htmlFor="ev-tel">Teléfono (opcional)</label>
          <input id="ev-tel" type="tel" inputMode="tel" value={f.telefono ?? ''} maxLength={20} onChange={(e) => set('telefono', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ev-notas">Notas</label>
          <textarea id="ev-notas" rows={3} value={f.notas ?? ''} maxLength={4000} onChange={(e) => set('notas', e.target.value)} />
        </div>

        {id && (
          <Opciones label="Estado" opciones={ESTADOS_EVENTO} valor={f.estado} onChange={(v) => set('estado', v)} nombres={NOMBRE_ESTADO_EVENTO} />
        )}

        <fieldset className="aj-estados">
          <legend className="label-l">Avisos</legend>
          {AVISOS.map((a) => (
            <label key={a.min} className="aj-check">
              <input
                type="checkbox"
                checked={f.avisos.includes(a.min)}
                onChange={() => set('avisos', f.avisos.includes(a.min) ? f.avisos.filter((x) => x !== a.min) : [...f.avisos, a.min].sort((x, y) => x - y))}
              />
              {a.txt}
            </label>
          ))}
        </fieldset>

        {(!deSerie || modo === 'serie') && (
          <div className="fields">
            <div className="field">
              <label htmlFor="ev-rep">Repetir</label>
              <select
                id="ev-rep"
                value={repId}
                onChange={(e) => {
                  const r = REPETICIONES_EVENTO.find((x) => x.id === e.target.value)
                  if (r) set('rrule', r.rrule ? conHasta(r.rrule, hastaDe(f.rrule)) : null)
                }}
              >
                {REPETICIONES_EVENTO.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
                {repId === 'personal' && <option value="personal">{nombreRepeticion(f.rrule)}</option>}
              </select>
            </div>
            {f.rrule && (
              <div className="field">
                <label htmlFor="ev-hasta">Hasta (opcional)</label>
                <input id="ev-hasta" type="date" min={f.fecha} value={hastaDe(f.rrule) ?? ''} onChange={(e) => set('rrule', conHasta(f.rrule!, e.target.value || null))} />
              </div>
            )}
          </div>
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
