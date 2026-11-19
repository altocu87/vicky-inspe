// Eventos que se repiten (RRULE). Se despliegan SOLO en el rango visible y con un tope.
// Con `rrule`, cada día es la medianoche UTC y se lee con getUTC* (así no influye la hora de España).
import { RRule } from 'rrule'
import { addDias, diasEntre, esIso } from './fechas'
import { rruleValida, ultimoDia, type Evento } from './eventos'

/** Una aparición concreta de un evento en un día */
export interface Ocurrencia {
  evento: Evento
  /** Día de esta aparición */
  fecha: string
  /** Último día (inclusivo) de esta aparición, o null si es de un día */
  fecha_fin: string | null
  /** Id único para la pantalla: el del evento, o «id@fecha» si es de una serie */
  clave: string
  /** Es parte de una serie (se puede editar «solo este» o «toda la serie») */
  deSerie: boolean
}

export const TOPE_OCURRENCIAS = 1000

const aUtc = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)))
const deUtc = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

/** Días (aaaa-mm-dd) en que aparece una serie entre desde y hasta (inclusive), con tope */
export function diasDeSerie(fechaInicio: string, rrule: string, desde: string, hasta: string, tope = TOPE_OCURRENCIAS): string[] {
  if (!rruleValida(rrule) || !esIso(fechaInicio) || !esIso(desde) || !esIso(hasta) || hasta < desde) return []
  const opciones = RRule.parseString(rrule)
  const regla = new RRule({ ...opciones, dtstart: aUtc(fechaInicio) })
  const out: string[] = []
  regla.between(aUtc(desde), aUtc(hasta), true, (d) => {
    out.push(deUtc(d))
    return out.length < tope
  })
  return out
}

/**
 * Despliega los eventos en el rango [desde, hasta]:
 * - los normales, si se solapan con el rango;
 * - las series, una aparición por día, quitando los días quitados (exdates) y los sustituidos por una excepción;
 * - las excepciones («solo este») como eventos normales.
 */
export function desplegar(eventos: readonly Evento[], desde: string, hasta: string, tope = TOPE_OCURRENCIAS): Ocurrencia[] {
  const out: Ocurrencia[] = []
  const sustituidos = new Set<string>()
  for (const e of eventos) if (e.serie_id && e.ocurrencia_original) sustituidos.add(`${e.serie_id}@${e.ocurrencia_original}`)
  for (const e of eventos) {
    if (out.length >= tope) break
    if (e.rrule && !e.serie_id) {
      const dur = e.fecha_fin ? diasEntre(e.fecha, e.fecha_fin) : 0
      const quitados = new Set(e.exdates)
      // Se empieza «dur» días antes para incluir las que empezaron antes y aún duran
      for (const d of diasDeSerie(e.fecha, e.rrule, addDias(desde, -dur), hasta, tope - out.length)) {
        if (quitados.has(d) || sustituidos.has(`${e.id}@${d}`)) continue
        out.push({ evento: e, fecha: d, fecha_fin: dur ? addDias(d, dur) : null, clave: `${e.id}@${d}`, deSerie: true })
      }
    } else if (e.fecha <= hasta && ultimoDia(e) >= desde) {
      out.push({ evento: e, fecha: e.fecha, fecha_fin: e.fecha_fin, clave: e.id, deSerie: !!e.serie_id })
    }
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Opciones sencillas de repetición para el formulario */
export const REPETICIONES_EVENTO: { id: string; nombre: string; rrule: string | null }[] = [
  { id: 'no', nombre: 'No se repite', rrule: null },
  { id: 'diaria', nombre: 'Cada día', rrule: 'FREQ=DAILY' },
  { id: 'laborable', nombre: 'De lunes a viernes', rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' },
  { id: 'semanal', nombre: 'Cada semana', rrule: 'FREQ=WEEKLY' },
  { id: 'quincenal', nombre: 'Cada 2 semanas', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { id: 'mensual', nombre: 'Cada mes', rrule: 'FREQ=MONTHLY' },
  { id: 'anual', nombre: 'Cada año', rrule: 'FREQ=YEARLY' },
]

/** Nombre de la repetición (o «Personalizada» si no es una de las sencillas) */
export function nombreRepeticion(rrule: string | null): string {
  if (!rrule) return 'No se repite'
  const base = rrule.replace(/;(COUNT|UNTIL)=[^;]+/g, '')
  return REPETICIONES_EVENTO.find((r) => r.rrule === base)?.nombre ?? 'Personalizada'
}

/** Añade o quita el final («hasta el día…») de una RRULE */
export function conHasta(rrule: string, hasta: string | null): string {
  const sin = rrule.replace(/;(COUNT|UNTIL)=[^;]+/g, '')
  return hasta && esIso(hasta) ? `${sin};UNTIL=${hasta.replace(/-/g, '')}` : sin
}

export function hastaDe(rrule: string | null): string | null {
  const m = rrule ? /UNTIL=(\d{4})(\d{2})(\d{2})/.exec(rrule) : null
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
