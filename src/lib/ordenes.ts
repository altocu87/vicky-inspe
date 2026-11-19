// Tipos y lógica de plazos migrada de las fórmulas del Excel real ("Hoja 1")
import { hoyIso } from './fechas'
import { contextoBase, peorNivelDe, plazoDe, proximoPlazo, type ContextoPlazos, type Nivel, type OrdenPlazos, type PlazoCalc } from './plazos/motor'

export const ESTADOS = ['EN CURSO', 'PTE ENTREGA', 'DEVUELTA', 'FINALIZADA'] as const
export const ESTADOS_DOCUM = ['AUN NADA', 'SOLICITADA', 'RECIBIDA', 'NO SE PIDE'] as const
export const ESTADOS_VISITA = ['SIN VISITA', '1º FALLIDA', '1º FALLIDA, 2º FALLIDA', '1º FALLIDA, REALIZADA', 'REALIZADA'] as const
export const SI_NO = ['SI', 'NO SE PONE'] as const

export type Estado = (typeof ESTADOS)[number]
export type EstadoDocum = (typeof ESTADOS_DOCUM)[number]
export type SiNo = (typeof SI_NO)[number]

export interface Orden {
  id: string
  num_orden: string
  estado: Estado
  empresa: string
  fecha_orden: string | null
  fecha_primera_actuacion: string | null
  fecha_ultima_actuacion: string | null
  fecha_cierre: string | null
  objeto: string | null
  estado_docum: EstadoDocum | null
  estado_visita: string | null
  fecha_visita: string | null
  situacion_general: string | null
  tareas_pendientes: string | null
  comparecencia_subida: SiNo | null
  doc_subida: SiNo | null
  claves: SiNo | null
  created_at: string
  updated_at: string
}

export type OrdenInput = Omit<Orden, 'id' | 'created_at' | 'updated_at'>

export const ORDEN_VACIA: OrdenInput = {
  num_orden: '',
  estado: 'EN CURSO',
  empresa: '',
  fecha_orden: null,
  fecha_primera_actuacion: null,
  fecha_ultima_actuacion: null,
  fecha_cierre: null,
  objeto: null,
  estado_docum: 'AUN NADA',
  estado_visita: 'SIN VISITA',
  fecha_visita: null,
  situacion_general: null,
  tareas_pendientes: null,
  comparecencia_subida: null,
  doc_subida: null,
  claves: null,
}

export const LABELS: Record<string, string> = {
  'EN CURSO': 'En curso',
  'PTE ENTREGA': 'Pte. entrega',
  DEVUELTA: 'Devuelta',
  FINALIZADA: 'Finalizada',
  'AUN NADA': 'Aún nada',
  SOLICITADA: 'Solicitada',
  RECIBIDA: 'Recibida',
  'NO SE PIDE': 'No se pide',
  'SIN VISITA': 'Sin visita',
  '1º FALLIDA': '1ª fallida',
  '1º FALLIDA, 2º FALLIDA': '1ª y 2ª fallidas',
  '1º FALLIDA, REALIZADA': '1ª fallida, realizada',
  REALIZADA: 'Realizada',
  SI: 'Sí',
  'NO SE PONE': 'No se pone',
}
export const label = (v: string | null | undefined) => (v ? (LABELS[v] ?? v) : '—')

// ---------- Fechas (en lib/fechas.ts; se reexportan para no romper imports) ----------
export { edate, hoyIso, diasHasta, fmt, fmtCorta } from './fechas'

// ---------- Plazos (calculados por el motor de reglas: lib/plazos) ----------
export type { Nivel } from './plazos/motor'

export interface Plazo {
  fecha: string
  dias: number
  nivel: Nivel
}

const soloFecha = (p: PlazoCalc | null): Plazo | null => (p ? { fecha: p.fecha, dias: p.dias, nivel: p.nivel } : null)

/** FECHA LIMITE 9 MESES = EDATE(1ª actuación; 9) */
export function plazo9Meses(o: Pick<OrdenInput, 'fecha_primera_actuacion'>, ctx: ContextoPlazos = contextoBase(hoyIso())): Plazo | null {
  return soloFecha(plazoDe(comoOrden(o), 'lim9', ctx))
}

/** FECHA LIMITE ULTIMA ACTUACION = EDATE(última; 5), sin pasar del límite de 9 meses */
export function plazoSiguiente(
  o: Pick<OrdenInput, 'fecha_primera_actuacion' | 'fecha_ultima_actuacion'>,
  ctx: ContextoPlazos = contextoBase(hoyIso()),
): Plazo | null {
  return soloFecha(plazoDe(comoOrden(o), 'sig', ctx))
}

function comoOrden(o: Partial<OrdenInput>): OrdenPlazos {
  return {
    estado: o.estado ?? 'EN CURSO',
    fecha_orden: o.fecha_orden ?? null,
    fecha_primera_actuacion: o.fecha_primera_actuacion ?? null,
    fecha_ultima_actuacion: o.fecha_ultima_actuacion ?? null,
  }
}

/** Texto de días como en el Excel: "SIN TIEMPO" si ya pasó */
export function textoDias(dias: number): string {
  if (dias < 0) return 'Sin tiempo'
  if (dias === 0) return 'Hoy'
  return `${dias} d`
}

export const activa = (o: OrdenInput) => o.estado !== 'FINALIZADA'

/** El aviso más urgente de una orden activa */
export function peorNivel(o: OrdenInput & { id?: string }, ctx: ContextoPlazos = contextoBase(hoyIso())): Nivel | null {
  if (!activa(o)) return null
  return peorNivelDe(o, ctx)
}

export function diasMinimos(o: OrdenInput & { id?: string }, ctx: ContextoPlazos = contextoBase(hoyIso())): number {
  if (!activa(o)) return 2e9
  return proximoPlazo(o, ctx)?.dias ?? 1e9
}

/** Pendientes de subir (comparecencia, doc., claves) en órdenes activas */
export function faltaSubir(o: OrdenInput): number {
  return [o.comparecencia_subida, o.doc_subida, o.claves].filter((v) => !v).length
}
