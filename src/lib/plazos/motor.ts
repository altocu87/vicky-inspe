// Motor de plazos: aplica las reglas a una orden y devuelve sus fechas límite.
// Es lógica pura (sin React ni Supabase) para poder usarla también en la Edge Function del correo.
import { addDias, diasEntre, edate, esIso } from '../fechas'
import { SIN_FESTIVOS, motivoInhabil, sumarHabiles, type Inhabil, type MapaFestivos } from '../habiles'
import { REGLAS_BASE, type Regla } from './reglas'

export type Nivel = 'ok' | 'medio' | 'urgente' | 'vencido'
export const NIVELES: readonly Nivel[] = ['vencido', 'urgente', 'medio', 'ok']
export const NOMBRE_NIVEL: Record<Nivel, string> = {
  vencido: 'Vencido',
  urgente: '30 días o menos',
  medio: 'De 31 a 90 días',
  ok: 'Más de 90 días',
}

/** Igual que el Excel: vencido < 0 ≤ urgente ≤ 30 < medio ≤ 90 < ok */
export function nivelDe(dias: number): Nivel {
  if (dias < 0) return 'vencido'
  if (dias <= 30) return 'urgente'
  if (dias <= 90) return 'medio'
  return 'ok'
}

/** Lo mínimo que el motor necesita de una orden */
export interface OrdenPlazos {
  id?: string
  estado: string
  fecha_orden: string | null
  fecha_primera_actuacion: string | null
  fecha_ultima_actuacion: string | null
}

/** Evento con fecha (fase 2: requerimientos, visitas…) para reglas que cuentan desde un evento */
export interface EventoPlazos {
  orden_id: string
  tipo: string
  fecha: string
}

export interface ContextoPlazos {
  hoy: string
  reglas: readonly Regla[]
  festivos: MapaFestivos
  eventos?: readonly EventoPlazos[]
}

export interface PlazoCalc {
  regla: Regla
  fecha: string
  /** Fecha de partida usada */
  desde: string
  dias: number
  nivel: Nivel
  /** El plazo cae en sábado, domingo o festivo (no se mueve: solo se marca) */
  inhabil: Inhabil | null
  /** La fecha se ha recortado por el tope de otra regla */
  recortado: boolean
  /** Cuenta para avisos y semáforos (regla activa y estado de la orden incluido) */
  aplica: boolean
}

export function contextoBase(hoy: string): ContextoPlazos {
  return { hoy, reglas: REGLAS_BASE, festivos: SIN_FESTIVOS }
}

function fechaPartida(o: OrdenPlazos, r: Regla, ctx: ContextoPlazos): string | null {
  if ('campo' in r.partida) {
    const v = o[r.partida.campo]
    return esIso(v) ? v : null
  }
  const tipo = r.partida.evento
  let ultima: string | null = null
  for (const e of ctx.eventos ?? []) {
    if (e.orden_id === o.id && e.tipo === tipo && esIso(e.fecha) && (!ultima || e.fecha > ultima)) ultima = e.fecha
  }
  return ultima
}

function sumar(desde: string, r: Regla, festivos: MapaFestivos): string {
  switch (r.unidad) {
    case 'meses':
      return edate(desde, r.cantidad)
    case 'dias':
      return addDias(desde, r.cantidad)
    case 'habiles':
      return sumarHabiles(desde, r.cantidad, festivos)
  }
}

/** Fecha sin tope de cada regla (con caché por llamada) y aplicando topes en cadena, sin bucles */
function calcularFecha(
  o: OrdenPlazos,
  r: Regla,
  ctx: ContextoPlazos,
  cache: Map<string, { fecha: string; desde: string; recortado: boolean } | null>,
  visitando: Set<string>,
): { fecha: string; desde: string; recortado: boolean } | null {
  if (cache.has(r.id)) return cache.get(r.id)!
  if (visitando.has(r.id)) return null // tope circular: se ignora
  visitando.add(r.id)
  let res: { fecha: string; desde: string; recortado: boolean } | null = null
  const desde = fechaPartida(o, r, ctx)
  if (desde) {
    let fecha = sumar(desde, r, ctx.festivos)
    let recortado = false
    const reglaTope = r.tope ? ctx.reglas.find((x) => x.id === r.tope) : undefined
    if (reglaTope) {
      const t = calcularFecha(o, reglaTope, ctx, cache, visitando)
      if (t && fecha > t.fecha) {
        fecha = t.fecha
        recortado = true
      }
    }
    res = { fecha, desde, recortado }
  }
  visitando.delete(r.id)
  cache.set(r.id, res)
  return res
}

/** Todos los plazos de una orden, en el orden de las reglas. Incluye los que no aplican (marcados). */
export function plazosDe(o: OrdenPlazos, ctx: ContextoPlazos): PlazoCalc[] {
  const cache = new Map<string, { fecha: string; desde: string; recortado: boolean } | null>()
  const out: PlazoCalc[] = []
  for (const r of ctx.reglas) {
    const c = calcularFecha(o, r, ctx, cache, new Set())
    if (!c) continue
    const dias = diasEntre(ctx.hoy, c.fecha)
    out.push({
      regla: r,
      fecha: c.fecha,
      desde: c.desde,
      dias,
      nivel: nivelDe(dias),
      inhabil: motivoInhabil(c.fecha, ctx.festivos),
      recortado: c.recortado,
      aplica: r.activa && r.estados.includes(o.estado as never),
    })
  }
  return out
}

/** Un plazo concreto (por id de regla), o null */
export function plazoDe(o: OrdenPlazos, id: string, ctx: ContextoPlazos): PlazoCalc | null {
  return plazosDe(o, ctx).find((p) => p.regla.id === id) ?? null
}

/** Como `plazoDe`, pero null si la regla está desactivada en Ajustes (para mostrar «—» en las columnas) */
export function plazoActivoDe(o: OrdenPlazos, id: string, ctx: ContextoPlazos): PlazoCalc | null {
  const p = plazoDe(o, id, ctx)
  return p && p.regla.activa ? p : null
}

/**
 * Plazos que hay que vigilar: aplican y no son un duplicado de su tope
 * (si «Siguiente» se recorta a «9 meses», sale solo una vez).
 */
export function plazosVigilados(o: OrdenPlazos, ctx: ContextoPlazos): PlazoCalc[] {
  const todos = plazosDe(o, ctx).filter((p) => p.aplica)
  return todos.filter((p) => !(p.recortado && todos.some((q) => q.regla.id === p.regla.tope && q.fecha === p.fecha)))
}

/** El plazo vigilado más cercano (el vencido más antiguo va primero) */
export function proximoPlazo(o: OrdenPlazos, ctx: ContextoPlazos): PlazoCalc | null {
  let mejor: PlazoCalc | null = null
  for (const p of plazosVigilados(o, ctx)) if (!mejor || p.fecha < mejor.fecha) mejor = p
  return mejor
}

/** El nivel más grave de la orden (null si no tiene plazos vigilados) */
export function peorNivelDe(o: OrdenPlazos, ctx: ContextoPlazos): Nivel | null {
  const niveles = new Set(plazosVigilados(o, ctx).map((p) => p.nivel))
  return NIVELES.find((n) => niveles.has(n)) ?? null
}
