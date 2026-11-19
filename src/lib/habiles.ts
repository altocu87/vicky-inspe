// Días hábiles: ni sábado, ni domingo, ni festivo.
import { addDias, diaSemana } from './fechas'

export type Ambito = 'nacional' | 'autonomico' | 'local'

export interface Festivo {
  fecha: string // aaaa-mm-dd
  nombre: string
  ambito: Ambito
  fuente?: string | null
}

/** Festivos indexados por fecha para buscarlos rápido */
export type MapaFestivos = ReadonlyMap<string, Festivo>

export const SIN_FESTIVOS: MapaFestivos = new Map()

export function mapaFestivos(lista: readonly Festivo[]): MapaFestivos {
  return new Map(lista.map((f) => [f.fecha, f]))
}

export function esFinde(iso: string): boolean {
  const d = diaSemana(iso)
  return d === 0 || d === 6
}

export function esHabil(iso: string, festivos: MapaFestivos): boolean {
  return !esFinde(iso) && !festivos.has(iso)
}

export type Inhabil = { motivo: 'sábado' | 'domingo' | 'festivo'; nombre?: string }

/** Por qué un día no es hábil (o null si lo es) */
export function motivoInhabil(iso: string, festivos: MapaFestivos): Inhabil | null {
  const f = festivos.get(iso)
  if (f) return { motivo: 'festivo', nombre: f.nombre }
  const d = diaSemana(iso)
  if (d === 6) return { motivo: 'sábado' }
  if (d === 0) return { motivo: 'domingo' }
  return null
}

/**
 * Suma N días hábiles: se empieza a contar el día SIGUIENTE a la fecha de partida
 * y solo cuentan los días hábiles. Con n = 0 devuelve la misma fecha.
 * Con n negativo cuenta hacia atrás.
 */
export function sumarHabiles(iso: string, n: number, festivos: MapaFestivos): string {
  if (!Number.isInteger(n)) throw new Error('n debe ser entero')
  if (Math.abs(n) > 5000) throw new Error('n fuera de rango')
  const paso = n < 0 ? -1 : 1
  let d = iso
  let quedan = Math.abs(n)
  while (quedan > 0) {
    d = addDias(d, paso)
    if (esHabil(d, festivos)) quedan--
  }
  return d
}

/** «Cae en sábado», «Cae en festivo (Inmaculada Concepción)» */
export function textoInhabil(i: Inhabil): string {
  return i.motivo === 'festivo' ? `Cae en festivo${i.nombre ? ` (${i.nombre})` : ''}` : `Cae en ${i.motivo}`
}
