import { useEffect, useRef, useState } from 'react'
import { ESTADOS, ESTADOS_DOCUM, ESTADOS_VISITA, LABELS, MAX_TEXTO, ORDEN_VACIA, fechaCierreAlGuardar, textoDemasiadoLargo, SI_NO, type Orden, type OrdenInput, type SiNo } from '../lib/ordenes'
import { api } from '../data/api'
import { numeroRepetido } from '../lib/filtros'
import { usePlazosCtx } from '../hooks'
import { NOMBRE_CAMPO } from '../lib/plazos/reglas'
import { plazosDe } from '../lib/plazos/motor'
import { ESTADO_ICONO } from './OrdenCard'
import { Plazo } from './Plazo'
import { BotonVerCalendario } from './plazos'
import { HistorialOrden } from './HistorialOrden'
import { useAgenda } from '../state/agenda'
import { useAcciones } from '../state/acciones'
import { eventoNuevo, NOMBRE_ESTADO_EVENTO, textoHora } from '../lib/eventos'
import { fmt as fmtLarga, esIso, nombreDia } from '../lib/fechas'

type Props = {
  orden: Orden | null // null = nueva
  onClose: () => void
  onSaved: (o: Orden, nueva: boolean) => void
  onDelete: (o: Orden) => void
  onError: (msg: string) => void
  /** Todas las órdenes cargadas (para avisar si el nº ya existe) */
  todas?: readonly Orden[]
}

function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
  icons,
  clearable,
  wrap,
}: {
  label: string
  options: readonly T[]
  value: T | null
  onChange: (v: T | null) => void
  icons?: Record<string, string>
  clearable?: boolean
  wrap?: boolean
}) {
  return (
    <div className="seg-wrap" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      <div className={`seg${wrap ? ' wrap' : ''}`}>
        {options.map((o) => {
          const on = value === o
          return (
            <button key={o} type="button" role="radio" aria-checked={on} className={on ? 'on' : ''} onClick={() => onChange(on && clearable ? null : o)}>
              {on ? <span className="icon">check</span> : icons && <span className="icon">{icons[o]}</span>}
              {LABELS[o] ?? o}
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
  error: errorDado,
  help: ayuda,
  placeholder,
  autoFocus,
  trailing,
  max,
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
  trailing?: React.ReactNode
  /** Longitud máxima (si se pasa, avisa) */
  max?: number
}) {
  const largo = (value ?? '').trim().length
  const error = errorDado || (max && largo > max ? `Demasiado largo: ${largo} de ${max} caracteres como mucho` : null)
  // Cerca del límite se ve cuánto queda
  const help = ayuda || (max && largo > max * 0.9 ? `${largo} de ${max} caracteres` : undefined)
  return (
    <div className={`field${error ? ' error' : ''}${trailing ? ' has-trailing' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} maxLength={max} aria-invalid={!!error} />
      ) : (
        <input
          id={id}
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          maxLength={max}
          aria-invalid={!!error}
          autoCapitalize={type === 'text' ? 'characters' : undefined}
        />
      )}
      {trailing}
      {(error || help) && <span className="help">{error || help}</span>}
    </div>
  )
}

const SUBIDAS: { k: 'comparecencia_subida' | 'doc_subida' | 'claves'; label: string }[] = [
  { k: 'comparecencia_subida', label: '¿Comparecencia subida?' },
  { k: 'doc_subida', label: '¿Documentación subida?' },
  { k: 'claves', label: 'Claves' },
]

export function OrdenForm({ orden, onClose, onSaved, onDelete, onError, todas = [] }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const datePick = useRef<HTMLInputElement>(null)
  const [inicial] = useState<OrdenInput>(() => (orden ? { ...orden } : { ...ORDEN_VACIA }))
  const [f, setF] = useState<OrdenInput>(inicial)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const nueva = !orden
  const ctx = usePlazosCtx()
  const ag = useAgenda()
  const acc = useAcciones()
  // Visitas elegidas con el minicalendario en una orden NUEVA: se crean al guardarla
  const [visitasNuevas, setVisitasNuevas] = useState<string[]>([])
  const ordenId = orden?.id
  const { cargarOrden } = ag
  useEffect(() => {
    if (ordenId) cargarOrden(ordenId)
  }, [ordenId, cargarOrden])
  const susEventos = ordenId ? ag.eventos.filter((e) => e.orden_id === ordenId).sort((a, b) => b.fecha.localeCompare(a.fecha)) : []
  const susTareas = ordenId ? ag.tareas.filter((t) => t.orden_id === ordenId).sort((a, b) => Number(a.hecha) - Number(b.hecha) || (a.vence ?? '9').localeCompare(b.vence ?? '9')) : []

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal()
  }, [])

  const set = <K extends keyof OrdenInput>(k: K, v: OrdenInput[K]) => setF((p) => ({ ...p, [k]: v }))
  const setTxt = (k: keyof OrdenInput) => (v: string) => set(k, (v === '' ? null : v) as never)

  const dirty = JSON.stringify(f) !== JSON.stringify(inicial)
  // Nº repetido: se avisa al escribirlo, sin esperar a guardar
  const repetida = numeroRepetido(f.num_orden, todas, orden?.id, orden?.num_orden)
  const errNum = tried && !f.num_orden.trim() ? 'Obligatorio' : repetida ? `Ya existe una orden con este nº (${repetida.empresa})` : null
  const errEmp = tried && !f.empresa.trim() ? 'Obligatorio' : null

  function cerrar() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Descartarlos?')) return
    ref.current?.close()
    onClose()
  }

  /** El minicalendario ya NO escribe texto: crea la visita en el calendario (enlazada a esta orden) */
  async function anadirFechaVisita(iso: string) {
    if (!esIso(iso)) return
    if (!ordenId) {
      setVisitasNuevas((v) => (v.includes(iso) ? v : [...v, iso].sort()))
      return
    }
    const e = await ag.crearEvento(eventoNuevo({ fecha: iso, tipo: 'visita', titulo: 'Visita', orden_id: ordenId }))
    if (e) acc.avisar(`Visita creada el ${fmtLarga(iso)}`)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!f.num_orden.trim() || !f.empresa.trim()) return
    if (repetida) return onError(`Ya existe otra orden con el nº ${repetida.num_orden}. Cambia el nº o abre la que ya existe.`)
    // Textos que pasan del límite (p. ej. heredados del Excel): se marcan en rojo y no se guarda
    if (textoDemasiadoLargo(f)) return onError('Hay un texto demasiado largo (marcado en rojo). Acórtalo para poder guardar.')
    setSaving(true)
    const t = (v: string | null) => (v && v.trim() ? v.trim() : null)
    // Datos tal y como se guardan (limpios). Se aplica igual a lo escrito y a la foto inicial.
    const limpiar = (f: OrdenInput) => ({
      num_orden: f.num_orden.trim().toUpperCase(),
      estado: f.estado,
      empresa: f.empresa.trim().toUpperCase(),
      fecha_orden: f.fecha_orden,
      fecha_primera_actuacion: f.fecha_primera_actuacion,
      fecha_ultima_actuacion: f.fecha_ultima_actuacion,
      fecha_cierre: fechaCierreAlGuardar(f.estado, f.fecha_cierre),
      objeto: t(f.objeto),
      estado_docum: f.estado_docum,
      estado_visita: f.estado_visita,
      fecha_visita: t(f.fecha_visita),
      situacion_general: t(f.situacion_general),
      tareas_pendientes: t(f.tareas_pendientes),
      comparecencia_subida: f.comparecencia_subida,
      doc_subida: f.doc_subida,
      claves: f.claves,
    })
    const todo = limpiar(f)
    // Al editar, solo se envían los campos que han cambiado: así no se pisan cambios hechos
    // mientras tanto desde otra pestaña o por ChatGPT en los campos que no se han tocado.
    const antes = limpiar(inicial)
    const payload = nueva ? todo : (Object.fromEntries(Object.entries(todo).filter(([k, v]) => v !== antes[k as keyof typeof antes])) as Partial<typeof todo>)
    if (!nueva && Object.keys(payload).length === 0) {
      ref.current?.close()
      onClose()
      return
    }
    try {
      const b = await api()
      const { data, error } = nueva ? await b.crearOrden(payload) : await b.actualizarOrden(orden.id, payload)
      if (error !== null) {
        setSaving(false)
        onError('No se pudo guardar: ' + error)
        return
      }
      // Si ha ido bien, «Guardando…» sigue hasta cerrar el formulario: así una segunda pulsación
      // mientras se crean las visitas no puede duplicar la orden.
      // Visitas elegidas antes de que existiera la orden (si alguna falla, la agenda ya avisa)
      for (const v of nueva ? visitasNuevas : []) await ag.crearEvento(eventoNuevo({ fecha: v, tipo: 'visita', titulo: 'Visita', orden_id: data.id }))
      ref.current?.close()
      onSaved(data, nueva)
    } catch {
      // Sin conexión: se libera el botón para poder reintentar
      setSaving(false)
      onError('No se pudo guardar: no hay conexión con el servidor. Inténtalo de nuevo.')
    }
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
              <Field
                id="num"
                label="Nº de orden *"
                value={f.num_orden}
                onChange={(v) => set('num_orden', v)}
                placeholder="2/0004814/24"
                error={errNum}
                autoFocus={nueva}
                max={MAX_TEXTO.num_orden}
              />
              <Field id="emp" label="Empresa *" value={f.empresa} onChange={(v) => set('empresa', v)} placeholder="Nombre de la empresa" error={errEmp} max={MAX_TEXTO.empresa} />
            </div>
            <Seg label="Estado" options={ESTADOS} value={f.estado} onChange={(v) => v && set('estado', v)} icons={ESTADO_ICONO} />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">calendar_month</span>
              <h3 className="title-m">Fechas y plazos</h3>
            </div>
            <div className="fields three">
              <Field id="fo" type="date" label="Fecha de la orden" value={f.fecha_orden} onChange={setTxt('fecha_orden')} />
              <Field id="fpa" type="date" label="1ª actuación" value={f.fecha_primera_actuacion} onChange={setTxt('fecha_primera_actuacion')} />
              <Field id="fua" type="date" label="Última actuación" value={f.fecha_ultima_actuacion} onChange={setTxt('fecha_ultima_actuacion')} />
              {fin && (
                <Field
                  id="fci"
                  type="date"
                  label="Fecha de cierre"
                  value={f.fecha_cierre}
                  onChange={setTxt('fecha_cierre')}
                  help="Si la dejas vacía, se pone la de hoy al guardar."
                />
              )}
            </div>
          </section>

          <section className="section agenda">
            <div className="section-title">
              <span className="icon">event_note</span>
              <h3 className="title-m">Agenda de esta orden</h3>
              {!nueva && <BotonVerCalendario orden={orden} />}
            </div>
            <div className="calc" aria-live="polite">
              {ctx.reglas
                .filter((r) => r.activa)
                .map((r) => {
                  const p = plazosDe({ ...f, id: orden?.id }, ctx).find((x) => x.regla.id === r.id) ?? null
                  const campo = 'campo' in r.partida ? NOMBRE_CAMPO[r.partida.campo] : r.partida.evento
                  return (
                    <Plazo
                      key={r.id}
                      titulo={`${r.nombre} (calculado)`}
                      plazo={p}
                      inhabil={p?.inhabil}
                      finalizada={fin}
                      vacio={`Indica la ${campo.toLowerCase()}`}
                      nota={p?.recortado ? `Recortado para no pasar de «${ctx.reglas.find((x) => x.id === r.tope)?.nombre ?? ''}»` : undefined}
                    />
                  )
                })}
            </div>
            {!nueva && (
              <>
                <h4 className="label-l agenda-sub">Visitas y citas</h4>
                {susEventos.length === 0 ? (
                  <p className="body-m muted agenda-vacio">Sin visitas ni citas.</p>
                ) : (
                  <ul className="agenda-lista">
                    {susEventos.map((e) => (
                      <li key={e.id}>
                        <button type="button" className={`agenda-item est-${e.estado}`} onClick={() => acc.editarEvento(e, e.fecha)}>
                          <span className="icon">{ag.tiposMap.get(e.tipo)?.icono ?? 'event'}</span>
                          <span className="agenda-txt">
                            <strong>
                              {nombreDia(e.fecha)} {fmtLarga(e.fecha)}
                            </strong>{' '}
                            · {textoHora(e)} · {ag.tiposMap.get(e.tipo)?.nombre ?? e.tipo}
                            {e.origen === 'excel' && <span className="tag">Excel</span>}
                          </span>
                          <span className={`tag est-${e.estado}`}>{NOMBRE_ESTADO_EVENTO[e.estado]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <h4 className="label-l agenda-sub">Tareas</h4>
                {susTareas.length === 0 ? (
                  <p className="body-m muted agenda-vacio">Sin tareas.</p>
                ) : (
                  <ul className="agenda-lista">
                    {susTareas.map((t) => (
                      <li key={t.id} className="agenda-tarea">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t.hecha ? `Marcar «${t.titulo}» como no hecha` : `Marcar «${t.titulo}» como hecha`}
                          disabled={acc.tareasEnCurso.has(t.id)}
                          onClick={() => acc.alternarTarea(t)}
                        >
                          <span className="icon">{t.hecha ? 'check_box' : 'check_box_outline_blank'}</span>
                        </button>
                        <button type="button" className={`agenda-item${t.hecha ? ' hecha' : ''}`} onClick={() => acc.editarTarea(t)}>
                          <span className="agenda-txt">
                            <strong>{t.titulo}</strong> · {t.vence ? fmtLarga(t.vence) : 'sin fecha'}
                            {t.oficina && <span className="tag">Oficina</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="agenda-botones">
                  {!fin && (
                    <button type="button" className="btn tonal" onClick={() => acc.programarVisita(orden.id)}>
                      <span className="icon">add_location_alt</span>
                      Programar visita
                    </button>
                  )}
                  <button type="button" className="btn tonal" onClick={() => acc.nuevoEvento({ fecha: ctx.hoy, tipo: 'comparecencia', orden_id: orden.id })}>
                    <span className="icon">event</span>
                    Otra cita
                  </button>
                  <button type="button" className="btn tonal" onClick={() => acc.nuevaTarea({ orden_id: orden.id })}>
                    <span className="icon">add_task</span>
                    Añadir tarea
                  </button>
                </div>
              </>
            )}
            {nueva && <p className="body-m muted agenda-vacio">Guarda la orden para añadirle visitas y tareas.</p>}
          </section>

          {!nueva && (
            <section className="section">
              <HistorialOrden orden={orden} />
            </section>
          )}

          <section className="section">
            <div className="section-title">
              <span className="icon">folder_open</span>
              <h3 className="title-m">Documentación</h3>
            </div>
            <Seg label="Estado de la documentación" options={ESTADOS_DOCUM} value={f.estado_docum} onChange={(v) => set('estado_docum', v)} clearable />
            <Field id="obj" label="Objeto" value={f.objeto} onChange={setTxt('objeto')} placeholder="Ej.: APORTA TODO LO SOLICITADO" max={MAX_TEXTO.objeto} />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">directions_car</span>
              <h3 className="title-m">Visita</h3>
            </div>
            <Seg label="Estado de la visita" options={ESTADOS_VISITA} value={f.estado_visita} onChange={(v) => set('estado_visita', v)} clearable wrap />
            {visitasNuevas.length > 0 && (
              <div className="chips" aria-label="Visitas que se crearán al guardar">
                {visitasNuevas.map((v) => (
                  <button key={v} type="button" className="chip on" onClick={() => setVisitasNuevas(visitasNuevas.filter((x) => x !== v))} aria-label={`Quitar la visita del ${fmtLarga(v)}`}>
                    <span className="icon">directions_car</span>
                    {fmtLarga(v)}
                    <span className="icon">close</span>
                  </button>
                ))}
              </div>
            )}
            <Field
              id="fv"
              label="Notas de visita (Excel)"
              value={f.fecha_visita}
              onChange={setTxt('fecha_visita')}
              max={MAX_TEXTO.fecha_visita}
              placeholder="NO VISITA, notas…"
              help="Texto heredado del Excel. Para programar una visita, usa el calendario de la derecha: se crea en el calendario."
              trailing={
                <>
                  <button
                    type="button"
                    className="icon-btn field-trailing"
                    aria-label="Crear una visita en el calendario"
                    title="Crear visita en el calendario"
                    onClick={() => {
                      const el = datePick.current
                      if (!el) return
                      if ('showPicker' in el) {
                        try {
                          el.showPicker()
                          return
                        } catch {
                          /* sigue */
                        }
                      }
                      el.click()
                    }}
                  >
                    <span className="icon">event</span>
                  </button>
                  <input
                    ref={datePick}
                    type="date"
                    tabIndex={-1}
                    aria-hidden
                    className="hidden-date"
                    onChange={(e) => {
                      anadirFechaVisita(e.target.value)
                      e.target.value = ''
                    }}
                  />
                </>
              }
            />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">checklist</span>
              <h3 className="title-m">Seguimiento</h3>
            </div>
            <Field id="sg" multiline label="Situación general" value={f.situacion_general} onChange={setTxt('situacion_general')} max={MAX_TEXTO.situacion_general} />
            <Field id="tp" multiline label="Tareas pendientes" value={f.tareas_pendientes} onChange={setTxt('tareas_pendientes')} max={MAX_TEXTO.tareas_pendientes} />
          </section>

          <section className="section">
            <div className="section-title">
              <span className="icon">cloud_upload</span>
              <h3 className="title-m">Subidas</h3>
            </div>
            <div className="subidas">
              {SUBIDAS.map((s) => (
                <Seg<SiNo> key={s.k} label={s.label} options={SI_NO} value={f[s.k]} onChange={(v) => set(s.k, v)} clearable />
              ))}
            </div>
            <p className="body-m muted" style={{ margin: 0 }}>
              Sin marcar = pendiente.
            </p>
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
          <button type="button" className="btn text hide-mobile" onClick={cerrar}>
            Cancelar
          </button>
          <button className="btn filled save-btn" disabled={saving}>
            <span className="icon">{saving ? 'hourglass_top' : 'save'}</span>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
