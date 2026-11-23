// Clases CSS de cada día del calendario de ordenador (oficina, visita, festivo, hoy).
// FullCalendar 7 entrega en dayCellClass/dayHeaderClass una fecha LOCAL (medianoche en España),
// así que se convierte con toIso (hora local). Leerla con getUTC* daría el día ANTERIOR.
import { toIso } from './fechas'
import type { MapaFestivos } from './habiles'
import { esDiaVisita, esOficina } from './semana'

/** Clases del día `iso` ('aaaa-mm-dd') */
export function marcasDia(iso: string, festivos: MapaFestivos, hoy: string): string {
  const c: string[] = []
  if (esOficina(iso)) c.push('d-oficina')
  if (esDiaVisita(iso)) c.push('d-visita')
  if (festivos.has(iso)) c.push('d-festivo')
  if (iso === hoy) c.push('d-hoy')
  return c.join(' ')
}

/** Clases de la celda de un día a partir de la fecha que da FullCalendar */
export const marcasCelda = (fecha: Date, festivos: MapaFestivos, hoy: string) => marcasDia(toIso(fecha), festivos, hoy)

/** Igual, para la cabecera del día (prefijo dh- en vez de d-) */
export const marcasCabecera = (fecha: Date, festivos: MapaFestivos, hoy: string) => marcasCelda(fecha, festivos, hoy).replace(/\bd-/g, 'dh-')
