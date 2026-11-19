// Fechas "de calendario" (sin hora) como texto ISO 'aaaa-mm-dd', siempre en hora LOCAL.
// Nunca se usa toISOString() para sacar el día: en España, a medianoche, daría el día anterior.

const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** true si es una fecha 'aaaa-mm-dd' que existe de verdad (no 2025-02-30) */
export function esIso(s: unknown): s is string {
  if (typeof s !== 'string') return false
  const m = RE_ISO.exec(s)
  if (!m) return false
  const d = new Date(+m[1], +m[2] - 1, +m[3])
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3]
}

export function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function toIso(d: Date): string {
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

/** Suma (o resta) días naturales */
export function addDias(iso: string, n: number): string {
  const d = parse(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

/** Días naturales de a hasta b (b - a). Redondea para no fallar con el cambio de hora. */
export function diasEntre(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000)
}

export function hoyIso(): string {
  return toIso(new Date())
}

export function diasHasta(iso: string, hoy: string = hoyIso()): number {
  return diasEntre(hoy, iso)
}

/** 0 = domingo … 6 = sábado (como Date.getDay) */
export function diaSemana(iso: string): number {
  return parse(iso).getDay()
}

/** Lunes de la semana (semana de lunes a domingo) */
export function lunesDe(iso: string): string {
  const dow = diaSemana(iso)
  return addDias(iso, dow === 0 ? -6 : 1 - dow)
}

export function finDeMes(iso: string): string {
  const d = parse(iso)
  return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0))
}

export function fmt(iso: string | null): string {
  if (!iso) return '—'
  return parse(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtCorta(iso: string | null): string {
  if (!iso) return '—'
  return parse(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreDia(iso: string): string {
  return DIAS_CORTOS[diaSemana(iso)]
}
export function nombreMesCorto(iso: string): string {
  return MESES_CORTOS[parse(iso).getMonth()]
}
/** «noviembre de 2026» */
export function nombreMes(iso: string): string {
  const d = parse(iso)
  return `${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`
}
