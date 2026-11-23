// Gestor de la agenda: abre los formularios, las fichas y la pregunta de la orden,
// y ofrece las acciones (AccionesCtx) a la tabla, al calendario y al formulario de la orden.
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAgenda } from '../../state/agenda'
import { AccionesCtx, type Acciones } from '../../state/acciones'
import { duplicar, eventoNuevo, type Evento, type EventoInput } from '../../lib/eventos'
import { hoyIso } from '../../lib/fechas'
import type { MapaFestivos } from '../../lib/habiles'
import type { Orden } from '../../lib/ordenes'
import { proximoHuecoVisita, visitasPorDia } from '../../lib/semana'
import { cambiosAlHacer, tareaNueva, type Tarea, type TareaInput } from '../../lib/tareas'
import { hayPropuesta, propuestaAlMarcar, type PropuestaOrden, type Resultado } from '../../lib/visitaEstado'
import { EventoForm, type ModoSerie } from './EventoForm'
import { TareaForm } from './TareaForm'
import { FichaEvento, FichaTarea } from './Ficha'
import { PreguntaOrden } from './PreguntaOrden'

type Abierto =
  | { tipo: 'evento'; inicial: EventoInput; id?: string; base?: Evento; ocurrencia?: string }
  | { tipo: 'tarea'; inicial: TareaInput; id?: string }
  | { tipo: 'fichaEvento'; evento: Evento; fecha: string }
  | { tipo: 'fichaTarea'; tarea: Tarea }
  | null

export function GestorAgenda({
  ordenes,
  festivos,
  abrirOrden,
  actualizarOrden,
  avisar,
  children,
}: {
  ordenes: readonly Orden[]
  festivos: MapaFestivos
  abrirOrden: (o: Orden) => void
  /** Guarda cambios en una orden y la actualiza en pantalla; devuelve false si falla */
  actualizarOrden: (o: Orden, cambios: Partial<Orden>) => Promise<boolean>
  avisar: (msg: string, err?: boolean, deshacer?: () => void) => void
  children: ReactNode
}) {
  const ag = useAgenda()
  const [abierto, setAbierto] = useState<Abierto>(null)
  const [pregunta, setPregunta] = useState<{ evento: Evento; fecha: string; orden?: Orden; propuesta: PropuestaOrden | null; resultado: Resultado } | null>(null)
  const porId = useMemo(() => new Map(ordenes.map((o) => [o.id, o])), [ordenes])
  const cerrar = () => setAbierto(null)

  const huecoVisita = useCallback(
    (desde = hoyIso()) => proximoHuecoVisita(desde, visitasPorDia(ag.eventos), festivos),
    [ag.eventos, festivos],
  )

  const marcar = useCallback(
    async (e: Evento, fecha: string, r: Resultado) => {
      // En una serie, solo se marca ESA aparición (se guarda como excepción «solo este»)
      const res = e.rrule
        ? await ag.crearEvento({ ...duplicar(e, fecha), estado: r, serie_id: e.id, ocurrencia_original: fecha })
        : await ag.actualizarEvento(e.id, { estado: r })
      if (!res) return
      // Siempre se ofrece apuntar los detalles de la visita; y, si es de una orden, actualizarla
      const o = e.orden_id ? porId.get(e.orden_id) : undefined
      const p = o ? propuestaAlMarcar(o, fecha, r, e.tipo === 'visita') : null
      setPregunta({ evento: res, fecha, orden: o, propuesta: p && hayPropuesta(p) ? p : null, resultado: r })
    },
    [ag, porId],
  )

  // Tareas que se están marcando: evita que dos pulsaciones seguidas la cambien dos veces
  // (el ref corta al momento; el estado sirve para desactivar el botón en pantalla)
  const enCursoRef = useRef(new Set<string>())
  const [tareasEnCurso, setTareasEnCurso] = useState<ReadonlySet<string>>(new Set())
  const alternarTarea = useCallback(
    async (t: Tarea) => {
      if (enCursoRef.current.has(t.id)) return
      enCursoRef.current.add(t.id)
      setTareasEnCurso(new Set(enCursoRef.current))
      const hoy = hoyIso()
      const cambios: Partial<TareaInput> = t.hecha ? { hecha: false, hecha_el: null } : cambiosAlHacer(t, hoy)
      const r = await ag.actualizarTarea(t.id, cambios).finally(() => {
        enCursoRef.current.delete(t.id)
        setTareasEnCurso(new Set(enCursoRef.current))
      })
      if (!r) return
      if (!t.hecha && r.hecha === false && r.vence) avisar(`Hecha. Se repite: la siguiente es el ${r.vence.split('-').reverse().join('/')}`)
      else avisar(r.hecha ? 'Tarea hecha' : 'Tarea pendiente otra vez', false, () => ag.actualizarTarea(t.id, { hecha: t.hecha, hecha_el: t.hecha_el, vence: t.vence }))
    },
    [ag, avisar],
  )

  const acciones = useMemo<Acciones>(
    () => ({
      abrirOrden: (id) => {
        const o = porId.get(id)
        if (o) abrirOrden(o)
      },
      programarVisita: (ordenId, fecha) => {
        const o = ordenId ? porId.get(ordenId) : undefined
        setAbierto({ tipo: 'evento', inicial: eventoNuevo({ fecha: fecha ?? huecoVisita(), tipo: 'visita', titulo: 'Visita', orden_id: o?.id ?? null }) })
      },
      nuevoEvento: (p = {}) => setAbierto({ tipo: 'evento', inicial: eventoNuevo({ fecha: hoyIso(), ...p }) }),
      editarEvento: (e, fecha) => {
        const { id, created_at, updated_at, ...resto } = e
        void created_at
        void updated_at
        setAbierto({ tipo: 'evento', inicial: resto, id, base: e, ocurrencia: e.rrule ? fecha : undefined })
      },
      nuevaTarea: (p = {}) => setAbierto({ tipo: 'tarea', inicial: tareaNueva(p) }),
      editarTarea: (t) => {
        const { id, created_at, updated_at, ...resto } = t
        void created_at
        void updated_at
        setAbierto({ tipo: 'tarea', inicial: resto, id })
      },
      verItem: (i) => {
        const r = i.ref
        if (r.tipo === 'evento') setAbierto({ tipo: 'fichaEvento', evento: r.oc.evento, fecha: r.oc.fecha })
        else if (r.tipo === 'tarea') setAbierto({ tipo: 'fichaTarea', tarea: r.tarea })
        else if (r.tipo === 'plazo' || r.tipo === 'hito') abrirOrden(r.orden)
      },
      marcar,
      alternarTarea,
      tareasEnCurso,
      huecoVisita,
      avisar: (m, e) => avisar(m, e),
    }),
    [porId, abrirOrden, huecoVisita, marcar, alternarTarea, tareasEnCurso, avisar],
  )

  async function guardarEvento(input: EventoInput, modo: ModoSerie): Promise<boolean> {
    if (abierto?.tipo !== 'evento') return false
    const { id, base, ocurrencia } = abierto
    if (!id) return !!(await ag.crearEvento(input))
    if (base?.rrule && ocurrencia && modo === 'solo') {
      // «Solo este»: una excepción que sustituye a ese día de la serie
      return !!(await ag.crearEvento({ ...input, rrule: null, exdates: [], serie_id: base.id, ocurrencia_original: ocurrencia }))
    }
    if (base?.rrule && ocurrencia && modo === 'serie') {
      // Toda la serie: se cambia todo menos el día de inicio de la serie
      return !!(await ag.actualizarEvento(id, { ...input, fecha: base.fecha, fecha_fin: base.fecha_fin }))
    }
    return !!(await ag.actualizarEvento(id, input))
  }

  async function eliminarEvento(e: Evento, fecha: string | undefined, modo: ModoSerie) {
    if (e.rrule && fecha && modo === 'solo') {
      if (!window.confirm(`¿Quitar solo el ${fecha.split('-').reverse().join('/')} de la serie?`)) return
      const r = await ag.actualizarEvento(e.id, { exdates: [...e.exdates, fecha] })
      if (r) {
        cerrar()
        avisar('Quitado ese día', false, () => ag.actualizarEvento(e.id, { exdates: e.exdates }))
      }
      return
    }
    if (!window.confirm(e.rrule ? '¿Eliminar TODA la serie?' : '¿Eliminar esta cita?')) return
    const { id, created_at, updated_at, ...copia } = e
    void id
    void created_at
    void updated_at
    if (await ag.eliminarEvento(e.id)) {
      cerrar()
      avisar('Eliminada', false, () => ag.crearEvento(copia))
    }
  }

  async function eliminarTarea(t: Tarea) {
    if (!window.confirm('¿Eliminar esta tarea?')) return
    const { id, created_at, updated_at, ...copia } = t
    void id
    void created_at
    void updated_at
    if (await ag.eliminarTarea(t.id)) {
      cerrar()
      avisar('Tarea eliminada', false, () => ag.crearTarea(copia))
    }
  }

  return (
    <AccionesCtx.Provider value={acciones}>
      {children}
      {abierto?.tipo === 'evento' && (
        <EventoForm
          key={abierto.id ?? 'nuevo'}
          inicial={abierto.inicial}
          id={abierto.id}
          ocurrencia={abierto.ocurrencia}
          ordenes={ordenes}
          onClose={cerrar}
          onGuardar={guardarEvento}
          onEliminar={abierto.base ? (modo) => eliminarEvento(abierto.base!, abierto.ocurrencia, modo) : undefined}
        />
      )}
      {abierto?.tipo === 'tarea' && (
        <TareaForm
          key={abierto.id ?? 'nueva'}
          inicial={abierto.inicial}
          id={abierto.id}
          ordenes={ordenes}
          onClose={cerrar}
          onGuardar={async (t) => !!(abierto.id ? await ag.actualizarTarea(abierto.id, t) : await ag.crearTarea(t))}
          onEliminar={
            abierto.id
              ? () => {
                  const t = ag.tareas.find((x) => x.id === abierto.id)
                  if (t) eliminarTarea(t)
                }
              : undefined
          }
        />
      )}
      {abierto?.tipo === 'fichaEvento' &&
        (() => {
          // Siempre la versión más reciente del evento (por si ha cambiado)
          const e = ag.eventos.find((x) => x.id === abierto.evento.id) ?? abierto.evento
          const o = e.orden_id ? porId.get(e.orden_id) : undefined
          return (
            <FichaEvento
              evento={e}
              fecha={abierto.fecha}
              orden={o}
              tipo={ag.tiposMap.get(e.tipo)}
              onClose={cerrar}
              onEditar={() => acciones.editarEvento(e, abierto.fecha)}
              onDuplicar={() => setAbierto({ tipo: 'evento', inicial: duplicar(e, abierto.fecha) })}
              // En una serie, desde la ficha se quita solo ese día (la serie entera, desde «Editar»)
              onEliminar={() => eliminarEvento(e, abierto.fecha, e.rrule ? 'solo' : 'serie')}
              onAbrirOrden={
                o
                  ? () => {
                      cerrar()
                      abrirOrden(o)
                    }
                  : undefined
              }
              onMarcar={async (r) => {
                cerrar()
                if (r === 'pendiente') {
                  if (e.serie_id || !e.rrule) await ag.actualizarEvento(e.id, { estado: 'pendiente' })
                  return
                }
                await marcar(e, abierto.fecha, r)
              }}
            />
          )
        })()}
      {abierto?.tipo === 'fichaTarea' &&
        (() => {
          const t = ag.tareas.find((x) => x.id === abierto.tarea.id) ?? abierto.tarea
          const o = t.orden_id ? porId.get(t.orden_id) : undefined
          return (
            <FichaTarea
              tarea={t}
              orden={o}
              onClose={cerrar}
              onEditar={() => acciones.editarTarea(t)}
              onEliminar={() => eliminarTarea(t)}
              onAlternar={async () => {
                cerrar()
                await alternarTarea(t)
              }}
              onAbrirOrden={
                o
                  ? () => {
                      cerrar()
                      abrirOrden(o)
                    }
                  : undefined
              }
            />
          )
        })()}
      {pregunta && (
        <PreguntaOrden
          titulo={pregunta.evento.titulo}
          fecha={pregunta.fecha}
          notasIniciales={pregunta.evento.notas}
          orden={pregunta.orden}
          propuesta={pregunta.propuesta}
          resultado={pregunta.resultado}
          esVisita={pregunta.evento.tipo === 'visita'}
          onClose={() => setPregunta(null)}
          onAplicar={async (notas, c) => {
            if (notas !== pregunta.evento.notas && !(await ag.actualizarEvento(pregunta.evento.id, { notas }))) return false
            const cambiaOrden = Object.keys(c).length > 0
            if (cambiaOrden && pregunta.orden && !(await actualizarOrden(pregunta.orden, c))) return false
            avisar(cambiaOrden ? 'Guardado y orden actualizada' : 'Guardado')
            return true
          }}
        />
      )}
    </AccionesCtx.Provider>
  )
}
