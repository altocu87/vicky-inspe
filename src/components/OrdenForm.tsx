import { useEffect, useRef, useState } from 'react'
import {
  ESTADOS,
  ESTADOS_DOCUM,
  ESTADOS_VISITA,
  LABELS,
  ORDEN_VACIA,
  plazo9Meses,
  plazoSiguiente,
  type Orden,
  type OrdenInput,
} from '../lib/ordenes'
import { supabase } from '../lib/supabase'
import { ESTADO_ICONO } from './OrdenCard'
import { Plazo } from './Plazo'

type Props = {
  orden: Orden | null // null = nueva
  onClose: () => void
  onSaved: (o: Orden, nueva: boolean) => void
  onDelete: (o: Orden) => void
  onError: (msg: string) => void
}

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
  icons,
  clearable,
}: {
  label: string
  options: readonly T[]
  value: T | null
  onChange: (v: T | null) => void
  icons?: Record<string, string>
  clearable?: boolean
}) {
  return (
    <div className="seg-wrap" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div className="seg">
        {options.map((o) => {
          const on = value === o
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? 'on' : ''}
              onClick={() => onChange(on && clearable ? null : o)}
            >
              {on ? <span className="icon">check</span> : icons && <span className="icon">{icons[o]}</span>}
              {LABELS[o]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  multiline,
  error,
  help,
  placeholder,
  autoFocus,
}: {
  id: string
  label: string
  value: string | null
  onChange: (v: string) => void
  type?: string
  multiline?: boolean
  error?: string | null
  help?: string
  placeholder?: string
  autoFocus?: boolean
}) {
  return (
    <div className={`field${error ? ' error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
      ) : (
        <input
          id={id}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={!!error}
        />
      )}
      {(error || help) && <span className="help">{error || help}</span>}
    </div>
  )
}

export function OrdenForm({ orden, onClose, onSaved, onDelete, onError }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const inicial: OrdenInput = orden ? { ...orden } : { ...ORDEN_VACIA }
  const [f, setF] = useState<OrdenInput>(inicial)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const nueva = !orden

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])

  const set = <K extends keyof OrdenInput>(k: K, v: OrdenInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const setTxt = (k: keyof OrdenInput) => (v: string) => set(k, (v === '' ? null : v) as never)

  const dirty = JSON.stringify(f) !== JSON.stringify(inicial)
  const errNum = tried && !f.num_orden.trim() ? 'Obligatorio' : null
  const errEmp = tried && !f.empresa.trim() ? 'Obligatorio' : null

  function cerrar() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    ref.current?.close()
    onClose()
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!f.num_orden.trim() || !f.empresa.trim()) return
    setSaving(true)
    const payload = {
      num_orden: f.num_orden.trim(),
      estado: f.estado,
      empresa: f.empresa.trim(),
      fecha_orden: f.fecha_orden,
      fecha_primera_actuacion: f.fecha_primera_actuacion,
      fecha_ultima_actuacion: f.fecha_ultima_actuacion,
      docum_aportada: f.docum_aportada,
      estado_docum: f.estado_docum,
      estado_visita: f.estado_visita,
      fecha_proxima_visita: f.fecha_proxima_visita,
      visitas_realizadas: f.visitas_realizadas,
      situacion_general: f.situacion_general,
      tareas_pendientes: f.tareas_pendientes,
    }
    const q = nueva
      ? supabase.from('ordenes').insert(payload).select().single()
      : supabase.from('ordenes').update(payload).eq('id', orden.id).select().single()
    const { data, error } = await q
    setSaving(false)
    if (error) {
      onError('No se pudo guardar: ' + error.message)
      return
    }
    ref.current?.close()
    onSaved(data as Orden, nueva)
  }

  const fin = f.estado === 'FINALIZADA'

  return (
    <dialog
      ref={ref}
      className="full"
      onCancel={(e) => {
        e.preventDefault()
        cerrar()
      }}
      aria-labelledby="dlg-title"
    >
      <form className="dlg" onSubmit={guardar} noValidate>
        <div className="dlg-head">
          <button type="button" className="icon-btn" onClick={cerrar} aria-label="Cerrar">
            <span className="icon">close</span>
          </button>
          <h2 id="dlg-title" className="headline">
            {nueva ? 'Nueva orden' : 'Editar orden'}
          </h2>
        </div>

        <div className="dlg-body">
          <section className="section">
            <div className="section-title">
              <span className="icon">badge</span>
              <h3 className="title-m">Datos de la orden</h3>
            </div>
            <div className="fields">
              <Field id="num" label="Nº de orden *" value={f.num_orden} onChange={(v) => set('num_orden', v)} placeholder="2/0004814/24" error={errNum} autoFocus={nueva} />
              <Field id="emp" label="Empresa *" value={f.empresa} onChange={(v) => set('empresa', v)} placeholder="Nombre de la empresa" error={errEmp} />
            </div>
            <Seg label="Estado" options={ESTADOS} value={f.estado} onChange={(v) => v && set('estado', v)} icons={ESTADO_ICONO} />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">calendar_month</span>
              <h3 className="title-m">Fechas y plazos</h3>
            </div>
            <div className="fields">
              <Field id="fo" type="date" label="Fecha de la orden" value={f.fecha_orden} onChange={setTxt('fecha_orden')} />
              <Field id="fpa" type="date" label="Primera actuación" value={f.fecha_primera_actuacion} onChange={setTxt('fecha_primera_actuacion')} />
              <Field id="fua" type="date" label="Última actuación" value={f.fecha_ultima_actuacion} onChange={setTxt('fecha_ultima_actuacion')} />
            </div>
            <div className="calc" aria-live="polite">
              <Plazo titulo="Límite 9 meses (calculado)" plazo={plazo9Meses(f)} finalizada={fin} vacio="Indica la primera actuación" />
              <Plazo titulo="Siguiente actuación (calculado)" plazo={plazoSiguiente(f)} finalizada={fin} vacio="Indica la última actuación" />
            </div>
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">folder_open</span>
              <h3 className="title-m">Documentación</h3>
            </div>
            <Seg label="Estado de la documentación" options={ESTADOS_DOCUM} value={f.estado_docum} onChange={(v) => set('estado_docum', v)} clearable />
            <Field id="doc" multiline label="Documentación aportada" value={f.docum_aportada} onChange={setTxt('docum_aportada')} placeholder="Un documento por línea" />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">directions_car</span>
              <h3 className="title-m">Visitas</h3>
            </div>
            <Seg label="Estado de la visita" options={ESTADOS_VISITA} value={f.estado_visita} onChange={(v) => set('estado_visita', v)} clearable />
            <div className="fields">
              <Field id="fpv" type="date" label="Próxima visita" value={f.fecha_proxima_visita} onChange={setTxt('fecha_proxima_visita')} />
            </div>
            <Field id="vr" multiline label="Visitas realizadas" value={f.visitas_realizadas} onChange={setTxt('visitas_realizadas')} placeholder="21/10/24: comentario de la visita" />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">checklist</span>
              <h3 className="title-m">Seguimiento</h3>
            </div>
            <Field id="sg" multiline label="Situación general" value={f.situacion_general} onChange={setTxt('situacion_general')} />
            <Field id="tp" multiline label="Tareas pendientes" value={f.tareas_pendientes} onChange={setTxt('tareas_pendientes')} />
          </section>
        </div>

        <div className="dlg-foot">
          {!nueva && (
            <button
              type="button"
              className="btn danger-text"
              onClick={() => {
                ref.current?.close()
                onDelete(orden)
              }}
            >
              <span className="icon">delete</span>
              Eliminar
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn text" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn filled" disabled={saving}>
            <span className="icon">{saving ? 'hourglass_top' : 'save'}</span>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
