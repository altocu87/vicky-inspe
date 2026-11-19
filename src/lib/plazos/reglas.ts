// Reglas de plazo: el ÚNICO sitio donde se define qué fechas límite existen.
// Las pantallas no conocen las reglas: preguntan al motor (motor.ts).
// Añadir una regla = añadir un objeto a REGLAS_BASE, o crearla en Ajustes (tabla reglas_plazo).
import type { Estado } from '../ordenes'

/** Campos de la orden desde los que puede contarse un plazo */
export const CAMPOS_PARTIDA = ['fecha_orden', 'fecha_primera_actuacion', 'fecha_ultima_actuacion'] as const
export type CampoPartida = (typeof CAMPOS_PARTIDA)[number]

export const NOMBRE_CAMPO: Record<CampoPartida, string> = {
  fecha_orden: 'Fecha de la orden',
  fecha_primera_actuacion: '1.ª actuación',
  fecha_ultima_actuacion: 'Última actuación',
}

/** Desde dónde se cuenta: un campo de la orden o el último evento de un tipo (fase 2) */
export type Partida = { campo: CampoPartida } | { evento: string }

export const UNIDADES = ['dias', 'habiles', 'meses'] as const
export type Unidad = (typeof UNIDADES)[number]
export const NOMBRE_UNIDAD: Record<Unidad, [string, string]> = {
  dias: ['día natural', 'días naturales'],
  habiles: ['día hábil', 'días hábiles'],
  meses: ['mes', 'meses'],
}

export interface Regla {
  id: string
  nombre: string
  /** Nombre corto para chips y tablas */
  corto: string
  partida: Partida
  unidad: Unidad
  cantidad: number
  /** Id de otra regla: el plazo no puede pasar de la fecha de esa regla */
  tope?: string | null
  /** Estados de la orden en los que el plazo cuenta (avisos, vista Plazos, semáforos) */
  estados: readonly Estado[]
  /** Días de aviso antes del vencimiento (0 = el mismo día) */
  avisos: readonly number[]
  activa: boolean
  /** true = definida en el código; false = creada en Ajustes */
  base: boolean
}

export const ESTADOS_ACTIVOS: readonly Estado[] = ['EN CURSO', 'PTE ENTREGA', 'DEVUELTA']
export const AVISOS_DEF: readonly number[] = [30, 15, 7, 3, 1, 0]

/** Las dos fechas límite del Excel. NO cambiar sin actualizar las pruebas. */
export const REGLAS_BASE: readonly Regla[] = [
  {
    id: 'lim9',
    nombre: 'Límite 9 meses',
    corto: '9 meses',
    partida: { campo: 'fecha_primera_actuacion' },
    unidad: 'meses',
    cantidad: 9,
    tope: null,
    estados: ESTADOS_ACTIVOS,
    avisos: AVISOS_DEF,
    activa: true,
    base: true,
  },
  {
    id: 'sig',
    nombre: 'Siguiente actuación',
    corto: 'Siguiente',
    partida: { campo: 'fecha_ultima_actuacion' },
    unidad: 'meses',
    cantidad: 5,
    tope: 'lim9',
    estados: ESTADOS_ACTIVOS,
    avisos: AVISOS_DEF,
    activa: true,
    base: true,
  },
]

/** Fila de la tabla reglas_plazo (ajustes de una regla base o una regla personalizada) */
export interface ReglaFila {
  id: string
  base: boolean
  activa: boolean
  nombre: string | null
  corto: string | null
  partida: string | null
  unidad: string | null
  cantidad: number | null
  tope: string | null
  estados: string[] | null
  avisos: number[] | null
}

const RE_ID = /^[a-z0-9_]{2,40}$/
const ESTADOS_VALIDOS = ['EN CURSO', 'PTE ENTREGA', 'DEVUELTA', 'FINALIZADA']

function avisosValidos(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length > 12) return null
  if (!v.every((n) => Number.isInteger(n) && n >= 0 && n <= 365)) return null
  return [...new Set(v as number[])].sort((a, b) => b - a)
}

/**
 * Junta las reglas del código con lo guardado en la base de datos.
 * Todo lo que viene de la base de datos se valida: una fila mal formada se ignora
 * (nunca se ejecuta nada de lo guardado, solo se leen datos).
 */
export function combinarReglas(filas: readonly ReglaFila[]): Regla[] {
  const porId = new Map(filas.filter((f) => f && RE_ID.test(f.id)).map((f) => [f.id, f]))
  const out: Regla[] = REGLAS_BASE.map((r) => {
    const f = porId.get(r.id)
    if (!f) return { ...r }
    return { ...r, activa: f.activa !== false, avisos: avisosValidos(f.avisos) ?? r.avisos }
  })
  const idsBase = new Set(REGLAS_BASE.map((r) => r.id))
  for (const f of porId.values()) {
    if (f.base || idsBase.has(f.id)) continue
    const r = reglaPersonalizada(f)
    if (r) out.push(r)
  }
  // Un tope solo vale si apunta a una regla que existe y no a sí misma
  const ids = new Set(out.map((r) => r.id))
  return out.map((r) => (r.tope && (!ids.has(r.tope) || r.tope === r.id) ? { ...r, tope: null } : r))
}

/** Partida guardada como texto: un campo de la orden o «evento:<tipo de cita>» */
export function leerPartida(t: string | null): Partida | null {
  if ((CAMPOS_PARTIDA as readonly string[]).includes(t ?? '')) return { campo: t as CampoPartida }
  const m = /^evento:([a-z0-9_]{2,40})$/.exec(t ?? '')
  return m ? { evento: m[1] } : null
}
export const textoPartida = (p: Partida): string => ('campo' in p ? p.campo : `evento:${p.evento}`)

function reglaPersonalizada(f: ReglaFila): Regla | null {
  const nombre = typeof f.nombre === 'string' ? f.nombre.trim().slice(0, 80) : ''
  if (!nombre) return null
  const partida = leerPartida(f.partida)
  if (!partida) return null
  if (!(UNIDADES as readonly string[]).includes(f.unidad ?? '')) return null
  if (!Number.isInteger(f.cantidad) || f.cantidad! < 1 || f.cantidad! > 3650) return null
  const estados = (f.estados ?? []).filter((e) => ESTADOS_VALIDOS.includes(e)) as Estado[]
  return {
    id: f.id,
    nombre,
    corto: (f.corto?.trim() || nombre).slice(0, 24),
    partida,
    unidad: f.unidad as Unidad,
    cantidad: f.cantidad!,
    tope: f.tope && RE_ID.test(f.tope) ? f.tope : null,
    estados: estados.length ? estados : ESTADOS_ACTIVOS,
    avisos: avisosValidos(f.avisos) ?? AVISOS_DEF,
    activa: f.activa !== false,
    base: false,
  }
}

/** «5 meses desde la última actuación, sin pasar de Límite 9 meses» */
export function describirRegla(r: Regla, todas: readonly Regla[]): string {
  const [uno, varios] = NOMBRE_UNIDAD[r.unidad]
  const desde = 'campo' in r.partida ? NOMBRE_CAMPO[r.partida.campo].toLowerCase() : `la última cita «${r.partida.evento}» (hecha o pendiente)`
  let t = `${r.cantidad} ${r.cantidad === 1 ? uno : varios} desde ${desde}`
  const tope = r.tope && todas.find((x) => x.id === r.tope)
  if (tope) t += `, sin pasar de «${tope.nombre}»`
  return t
}
