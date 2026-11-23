// Cálculos sencillos de la página de Estadísticas (sin React, para poder probarlos).
import { edate, esIso } from './fechas'

/**
 * ¿Se cerró dentro de los 9 meses desde la primera actuación?
 * Usa la misma suma de meses que el motor de plazos (`edate`, que ajusta a fin de mes:
 * 31-may + 9 meses = 28-feb) y compara las fechas ISO como texto, sin pasar por horas ni UTC.
 */
export function cerradaDentroDe9Meses(primeraActuacion: string, cierre: string): boolean {
  if (!esIso(primeraActuacion) || !esIso(cierre)) return false
  return cierre <= edate(primeraActuacion, 9)
}
