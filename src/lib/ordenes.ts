// Tipos y lógica de plazos migrada de las fórmulas del Excel real ("Hoja 1")

export const ESTADOS = ['EN CURSO', 'PTE ENTREGA', 'FINALIZADA'] as const
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

// ---------- Fechas ----------
function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
/** Equivalente a EDATE de Excel: suma meses y ajusta al último día si el mes es más corto */
export function edate(iso: string, months: number): string {
  const d = parse(iso)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  return toIso(target)
}
export function hoyIso(): string {
  return toIso(new Date())
}
export function diasHasta(iso: string): number {
  const ms = parse(iso).getTime() - parse(hoyIso()).getTime()
  return Math.round(ms / 86_400_000)
}
export function fmt(iso: string | null): string {
  if (!iso) return '—'
  return parse(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function fmtCorta(iso: string | null): string {
  if (!iso) return '—'
  return parse(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ---------- Plazos (columnas calculadas del Excel) ----------
export type Nivel = 'ok' | 'medio' | 'urgente' | 'vencido'

export interface Plazo {
  fecha: string
  dias: number
  nivel: Nivel
}

function nivel(dias: number): Nivel {
  if (dias < 0) return 'vencido'
  if (dias <= 30) return 'urgente'
  if (dias <= 90) return 'medio'
  return 'ok'
}

/** FECHA LIMITE 9 MESES = EDATE(1ª actuación; 9) */
export function plazo9Meses(o: Pick<OrdenInput, 'fecha_primera_actuacion'>): Plazo | null {
  if (!o.fecha_primera_actuacion) return null
  const fecha = edate(o.fecha_primera_actuacion, 9)
  const dias = diasHasta(fecha)
  return { fecha, dias, nivel: nivel(dias) }
}

/** FECHA LIMITE ULTIMA ACTUACION = EDATE(última; 5), sin pasar del límite de 9 meses */
export function plazoSiguiente(
  o: Pick<OrdenInput, 'fecha_primera_actuacion' | 'fecha_ultima_actuacion'>,
): Plazo | null {
  if (!o.fecha_ultima_actuacion) return null
  let fecha = edate(o.fecha_ultima_actuacion, 5)
  const lim = plazo9Meses(o)
  if (lim && fecha > lim.fecha) fecha = lim.fecha
  const dias = diasHasta(fecha)
  return { fecha, dias, nivel: nivel(dias) }
}

/** Texto de días como en el Excel: "SIN TIEMPO" si ya pasó */
export function textoDias(dias: number): string {
  if (dias < 0) return 'Sin tiempo'
  if (dias === 0) return 'Hoy'
  return `${dias} d`
}

export const activa = (o: OrdenInput) => o.estado !== 'FINALIZADA'

/** El aviso más urgente de una orden activa */
export function peorNivel(o: OrdenInput): Nivel | null {
  if (!activa(o)) return null
  const orden: Nivel[] = ['vencido', 'urgente', 'medio', 'ok']
  const niveles = [plazo9Meses(o)?.nivel, plazoSiguiente(o)?.nivel].filter(Boolean) as Nivel[]
  return orden.find((n) => niveles.includes(n)) ?? null
}

export function diasMinimos(o: OrdenInput): number {
  if (!activa(o)) return 2e9
  const d = [plazo9Meses(o)?.dias, plazoSiguiente(o)?.dias].filter((x) => x !== undefined) as number[]
  return d.length ? Math.min(...d) : 1e9
}

/** Pendientes de subir (comparecencia, doc., claves) en órdenes activas */
export function faltaSubir(o: OrdenInput): number {
  return [o.comparecencia_subida, o.doc_subida, o.claves].filter((v) => !v).length
}
