// Vistas Día, Semana (con horas), Mes y Año en el ORDENADOR, con FullCalendar v7 (licencia MIT).
// Se carga con import() diferido: en el móvil no se descarga nunca.
// Crear arrastrando sobre un hueco, mover y estirar; si falla al guardar, vuelve a su sitio.
import { useEffect, useMemo, useRef } from 'react'
import FullCalendar, { type CalendarRef, type EventInput } from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import multiMonthPlugin from '@fullcalendar/react/multimonth'
import interactionPlugin, { Draggable } from '@fullcalendar/react/interaction'
import monarchTheme from '@fullcalendar/react/themes/monarch'
import esLocale from '@fullcalendar/react/locales/es'
import '@fullcalendar/react/skeleton.css'
import '@fullcalendar/react/themes/monarch/theme.css'
import '../../fc-tema.css'
import type { ItemCal } from '../../lib/capas'
import { toIso } from '../../lib/fechas'
import { finExclusivo, finInclusivo } from '../../lib/todoElDia'
import type { MapaFestivos } from '../../lib/habiles'
import { esDiaVisita, esOficina } from '../../lib/semana'

export type VistaFCId = 'dia' | 'semana' | 'mes' | 'anio'
const VISTA_FC: Record<VistaFCId, string> = { dia: 'timeGridDay', semana: 'timeGridWeek', mes: 'dayGridMonth', anio: 'multiMonthYear' }

/** Cambios de fecha/hora tras mover o estirar */
export interface Movimiento {
  fecha: string
  fecha_fin: string | null
  hora: string | null
  hora_fin: string | null
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
/** FullCalendar marca los días con fechas «UTC» (DateMarker): se leen con getUTC* */
const isoMarcador = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

function aEvento(i: ItemCal): EventInput {
  const conHora = !!i.hora
  return {
    id: i.clave,
    title: i.titulo,
    start: conHora ? `${i.fecha}T${i.hora}` : i.fecha,
    end: conHora ? (i.hora_fin ? `${i.fecha}T${i.hora_fin}` : undefined) : finExclusivo(i.fecha, i.fecha_fin),
    allDay: !conHora,
    editable: i.movible,
    durationEditable: i.movible && i.capa === 'citas',
    className: `fc-i c-${i.capa} ${i.tono}${i.hecho ? ' hecho' : ''}`,
    extendedProps: { item: i },
  }
}

export default function VistaFC({
  vista,
  fecha,
  items,
  festivos,
  hoy,
  panelPP,
  onItem,
  onCrear,
  onMover,
  onSoltar,
}: {
  vista: VistaFCId
  fecha: string
  items: readonly ItemCal[]
  festivos: MapaFestivos
  hoy: string
  /** Contenedor del panel «Por programar» (sus elementos se pueden arrastrar al calendario) */
  panelPP: HTMLElement | null
  onItem: (i: ItemCal) => void
  onCrear: (m: Movimiento) => void
  onMover: (i: ItemCal, m: Movimiento) => Promise<boolean>
  onSoltar: (datos: DOMStringMap, m: Movimiento) => void
}) {
  const ref = useRef<CalendarRef>(null)
  const eventos = useMemo(() => items.map(aEvento), [items])

  // La vista y la fecha mandan desde fuera (URL)
  useEffect(() => {
    const api = ref.current?.getApi()
    if (!api) return
    if (api.view.type !== VISTA_FC[vista]) api.changeView(VISTA_FC[vista], fecha)
    else api.gotoDate(fecha)
  }, [vista, fecha])

  // Arrastrar desde «Por programar»
  useEffect(() => {
    if (!panelPP) return
    const d = new Draggable(panelPP, { itemSelector: '[data-pp]', eventData: (el) => ({ title: el.getAttribute('data-titulo') ?? '', create: false }) })
    return () => d.destroy()
  }, [panelPP])

  const marcas = (iso: string) => {
    const c: string[] = []
    if (esOficina(iso)) c.push('d-oficina')
    if (esDiaVisita(iso)) c.push('d-visita')
    if (festivos.has(iso)) c.push('d-festivo')
    if (iso === hoy) c.push('d-hoy')
    return c.join(' ')
  }

  return (
    <div className={`fc-caja v-${vista}`}>
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin, monarchTheme]}
        locale={esLocale}
        initialView={VISTA_FC[vista]}
        initialDate={fecha}
        headerToolbar={false}
        firstDay={1}
        height="auto"
        nowIndicator
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        scrollTime="08:00:00"
        allDayText="Todo el día"
        dayMaxEvents
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotHeaderFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        events={eventos}
        editable
        selectable
        selectMirror
        droppable
        dayCellClass={(a) => marcas(isoMarcador(a.date))}
        dayHeaderClass={(a) => ('date' in a && a.date instanceof Date ? marcas(isoMarcador(a.date)).replace(/\bd-/g, 'dh-') : '')}
        eventContent={(a) => {
          // La «sombra» al seleccionar o arrastrar desde fuera no lleva datos propios
          const i = a.event.extendedProps.item as ItemCal | undefined
          return (
            <span className="fc-ic">
              <span className="icon" aria-hidden>
                {i?.icono ?? 'add'}
              </span>
              {a.timeText && <span className="fc-ic-h">{a.timeText}</span>}
              <span className="fc-ic-t">{i?.titulo ?? a.event.title}</span>
            </span>
          )
        }}
        eventClick={(a) => {
          a.jsEvent.preventDefault()
          const i = a.event.extendedProps.item as ItemCal | undefined
          if (i) onItem(i)
        }}
        select={(s) => {
          const fecha = toIso(s.start)
          if (s.allDay) onCrear({ fecha, fecha_fin: s.endStr ? finInclusivo(fecha, toIso(s.end)) : null, hora: null, hora_fin: null })
          else onCrear({ fecha, fecha_fin: null, hora: hhmm(s.start), hora_fin: toIso(s.end) === fecha ? hhmm(s.end) : null })
          ref.current?.getApi().unselect()
        }}
        eventDrop={async (a) => {
          const i = a.event.extendedProps.item as ItemCal | undefined
          // Si falla al guardar, el evento vuelve a su sitio (el aviso lo da quien guarda)
          if (!i || !(await onMover(i, movimiento(a.event.start, a.event.end, a.event.allDay)))) a.revert()
        }}
        eventResize={async (a) => {
          const i = a.event.extendedProps.item as ItemCal | undefined
          if (!i || !(await onMover(i, movimiento(a.event.start, a.event.end, a.event.allDay)))) a.revert()
        }}
        drop={(a) => {
          const fecha = toIso(a.date)
          onSoltar(a.draggedEl.dataset, { fecha, fecha_fin: null, hora: a.allDay ? null : hhmm(a.date), hora_fin: null })
        }}
      />
    </div>
  )
}

function movimiento(start: Date | null, end: Date | null, allDay: boolean): Movimiento {
  const fecha = toIso(start!)
  if (allDay) {
    const fin = end ? toIso(end) : null
    const incl = finInclusivo(fecha, fin)
    return { fecha, fecha_fin: incl !== fecha ? incl : null, hora: null, hora_fin: null }
  }
  return { fecha, fecha_fin: null, hora: hhmm(start!), hora_fin: end && toIso(end) === fecha ? hhmm(end) : null }
}

