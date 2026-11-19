// Textos y opciones de repetición para formularios y fichas. Sin la librería `rrule`
// (así esas pantallas no la descargan: solo hace falta para desplegar las series en el calendario).
import { esIso } from './fechas'

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
