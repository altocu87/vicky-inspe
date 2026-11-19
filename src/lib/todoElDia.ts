// Eventos «de todo el día»: FullCalendar trabaja con el fin EXCLUSIVO (del 3 al 5 → fin el 6)
// y en la base de datos se guarda INCLUSIVO (fin el 5). Se convierte SOLO aquí.
import { addDias, esIso } from './fechas'

/** De la base de datos (fin inclusivo, puede ser null = un solo día) a FullCalendar (fin exclusivo) */
export function finExclusivo(inicio: string, finInclusivo: string | null): string {
  if (!esIso(inicio)) throw new Error('Fecha de inicio no válida')
  const fin = finInclusivo && esIso(finInclusivo) && finInclusivo >= inicio ? finInclusivo : inicio
  return addDias(fin, 1)
}

/** De FullCalendar (fin exclusivo, puede faltar) a la base de datos (fin inclusivo) */
export function finInclusivo(inicio: string, finExclusivo: string | null | undefined): string {
  if (!esIso(inicio)) throw new Error('Fecha de inicio no válida')
  if (!finExclusivo || !esIso(finExclusivo) || finExclusivo <= inicio) return inicio
  return addDias(finExclusivo, -1)
}
