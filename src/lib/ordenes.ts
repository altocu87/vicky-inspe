// Tipos y lógica de plazos migrada de las fórmulas del Excel real ("Hoja 1")
import { esIso, hoyIso } from './fechas'
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

/** Columnas que se piden a la base de datos (todas las del tipo Orden: las usan la tabla, el CSV y el formulario) */
export const COLS_ORDEN =
  'id,num_orden,estado,empresa,fecha_orden,fecha_primera_actuacion,fecha_ultima_actuacion,fecha_cierre,objeto,estado_docum,estado_visita,fecha_visita,situacion_general,tareas_pendientes,comparecencia_subida,doc_subida,claves,created_at,updated_at'

const RE_UUID_ORDEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const textoONulo = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const fechaONula = (v: unknown): string | null => (esIso(v) ? (v as string) : null)
const deLista = <T extends string>(v: unknown, lista: readonly T[]): T | null => ((lista as readonly unknown[]).includes(v) ? (v as T) : null)

/**
 * Valida una fila de la tabla «ordenes» (como leerEvento/leerTarea). Sin id, nº, empresa o un estado
 * conocido se descarta (null); un dato opcional raro se deja vacío. Los textos no se recortan.
 */
export function leerOrden(f: unknown): Orden | null {
  if (!f || typeof f !== 'object') return null
  const r = f as Record<string, unknown>
  if (typeof r.id !== 'string' || !RE_UUID_ORDEN.test(r.id)) return null
  if (typeof r.num_orden !== 'string' || typeof r.empresa !== 'string') return null
  const estado = deLista(r.estado, ESTADOS)
  if (!estado) return null
  return {
    id: r.id,
    num_orden: r.num_orden,
    estado,
    empresa: r.empresa,
    fecha_orden: fechaONula(r.fecha_orden),
    fecha_primera_actuacion: fechaONula(r.fecha_primera_actuacion),
    fecha_ultima_actuacion: fechaONula(r.fecha_ultima_actuacion),
    fecha_cierre: fechaONula(r.fecha_cierre),
    objeto: textoONulo(r.objeto),
    estado_docum: deLista(r.estado_docum, ESTADOS_DOCUM),
    estado_visita: textoONulo(r.estado_visita),
    fecha_visita: textoONulo(r.fecha_visita),
    situacion_general: textoONulo(r.situacion_general),
    tareas_pendientes: textoONulo(r.tareas_pendientes),
    comparecencia_subida: deLista(r.comparecencia_subida, SI_NO),
    doc_subida: deLista(r.doc_subida, SI_NO),
    claves: deLista(r.claves, SI_NO),
    created_at: typeof r.created_at === 'string' ? r.created_at : '',
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : '',
  }
}

/**
 * Longitud máxima de los textos de una orden. La usan el formulario y el servidor MCP, y coincide con
 * la propuesta de CHECK en la base de datos (docs/propuestas-bd/medios-4-15.sql, #7): el historial
 * guarda hasta 4000 caracteres, así que un texto vaciado o cambiado se puede recuperar entero.
 */
export const MAX_TEXTO = {
  num_orden: 40,
  empresa: 200,
  objeto: 500,
  fecha_visita: 500,
  situacion_general: 4000,
  tareas_pendientes: 4000,
} as const

/** Primer texto que pasa de su límite (o null si todo cabe) */
export function textoDemasiadoLargo(o: Partial<Record<keyof typeof MAX_TEXTO, string | null>>): keyof typeof MAX_TEXTO | null {
  for (const k of Object.keys(MAX_TEXTO) as (keyof typeof MAX_TEXTO)[]) if ((o[k] ?? '').trim().length > MAX_TEXTO[k]) return k
  return null
}

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

/**
 * Fecha de cierre que se envía al guardar: si está FINALIZADA y no tiene, la de HOY en España
 * (la base de datos pondría la de hoy en UTC, que entre las 00:00 y las 01:00/02:00 es el día anterior).
 * Si no está finalizada, ninguna.
 */
export function fechaCierreAlGuardar(estado: Estado, fecha: string | null, hoy: string = hoyIso()): string | null {
  if (estado !== 'FINALIZADA') return null
  return fecha || hoy
}

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
