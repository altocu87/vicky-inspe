// Tipos y lógica de plazos migrada de las fórmulas del Excel (hoja ORDENES)

export const ESTADOS = ['SIN EMPEZAR', 'EN CURSO', 'FINALIZADA'] as const
export const ESTADOS_DOCUM = ['SOLICITADA', 'PTE RECTIFICACION', 'ENTREGADA'] as const
export const ESTADOS_VISITA = ['SIN VISITA', 'PLANIFICADA', 'REALIZADA'] as const

export type Estado = (typeof ESTADOS)[number]
export type EstadoDocum = (typeof ESTADOS_DOCUM)[number]
export type EstadoVisita = (typeof ESTADOS_VISITA)[number]

export interface Orden {
  id: string
  num_orden: string
  estado: Estado
  empresa: string
  fecha_orden: string | null
  fecha_primera_actuacion: string | null
  fecha_ultima_actuacion: string | null
  docum_aportada: string | null
  estado_docum: EstadoDocum | null
  estado_visita: EstadoVisita | null
  fecha_proxima_visita: string | null
  visitas_realizadas: string | null
  situacion_general: string | null
  tareas_pendientes: string | null
  created_at: string
  updated_at: string
}

export type OrdenInput = Omit<Orden, 'id' | 'created_at' | 'updated_at'>

export const ORDEN_VACIA: OrdenInput = {
  num_orden: '',
  estado: 'SIN EMPEZAR',
  empresa: '',
  fecha_orden: null,
  fecha_primera_actuacion: null,
  fecha_ultima_actuacion: null,
  docum_aportada: null,
  estado_docum: null,
  estado_visita: 'SIN VISITA',
  fecha_proxima_visita: null,
  visitas_realizadas: null,
  situacion_general: null,
  tareas_pendientes: null,
}

export const LABELS: Record<string, string> = {
  'SIN EMPEZAR': 'Sin empezar',
  'EN CURSO': 'En curso',
  FINALIZADA: 'Finalizada',
  SOLICITADA: 'Solicitada',
  'PTE RECTIFICACION': 'Pte. rectificación',
  ENTREGADA: 'Entregada',
  'SIN VISITA': 'Sin visita',
  PLANIFICADA: 'Planificada',
  REALIZADA: 'Realizada',
}

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

/** FECHA LIMITE 9 MESES = primera actuación + 9 meses */
export function plazo9Meses(o: Pick<OrdenInput, 'fecha_primera_actuacion'>): Plazo | null {
  if (!o.fecha_primera_actuacion) return null
  const fecha = edate(o.fecha_primera_actuacion, 9)
  const dias = diasHasta(fecha)
  return { fecha, dias, nivel: nivel(dias) }
}

/** FECHA LIMITE ULTIMA ACTUACION = última actuación + 5 meses, sin pasar del límite de 9 meses */
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

export const NIVEL_TEXTO: Record<Nivel, string> = {
  ok: 'Más de 90 días',
  medio: 'Entre 30 y 90 días',
  urgente: 'Menos de 30 días',
  vencido: 'Vencido',
}

/** El aviso más urgente de una orden (para ordenar y filtrar) */
export function peorNivel(o: OrdenInput): Nivel | null {
  if (o.estado === 'FINALIZADA') return null
  const orden: Nivel[] = ['vencido', 'urgente', 'medio', 'ok']
  const niveles = [plazo9Meses(o)?.nivel, plazoSiguiente(o)?.nivel].filter(Boolean) as Nivel[]
  if (!niveles.length) return null
  return orden.find((n) => niveles.includes(n)) ?? null
}

export function diasMinimos(o: OrdenInput): number {
  if (o.estado === 'FINALIZADA') return 2e9
  const d = [plazo9Meses(o)?.dias, plazoSiguiente(o)?.dias].filter((x) => x !== undefined) as number[]
  return d.length ? Math.min(...d) : 1e9
}
