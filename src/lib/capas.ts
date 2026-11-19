// Lo que se pinta en el calendario, por capas, con los MISMOS filtros que la tabla.
// - Lo enlazado a una orden sale solo si la orden pasa los filtros (estado, urgentes, búsqueda…).
// - Lo que no es de ninguna orden sale si no hay filtro de estado/nivel y coincide con la búsqueda.
import { addDias, diasEntre, esIso } from './fechas'
import type { EstadoEvento, TipoCita } from './eventos'
import { normal, type Filtros } from './filtros'
import type { Festivo } from './habiles'
import type { Orden } from './ordenes'
import { plazosVigilados, type ContextoPlazos, type Nivel, type PlazoCalc } from './plazos/motor'
import type { Ocurrencia } from './repeticion'
import type { Tarea } from './tareas'

export const CAPAS = ['plazos', 'citas', 'tareas', 'hitos', 'festivos'] as const
export type Capa = (typeof CAPAS)[number]
export const INFO_CAPA: Record<Capa, { nombre: string; icono: string }> = {
  plazos: { nombre: 'Plazos', icono: 'flag' },
  citas: { nombre: 'Visitas y citas', icono: 'directions_car' },
  tareas: { nombre: 'Tareas', icono: 'task_alt' },
  hitos: { nombre: 'Hitos de la orden', icono: 'history' },
  festivos: { nombre: 'Festivos', icono: 'celebration' },
}
/** «Hitos de la orden» empieza apagada */
export const CAPAS_DEF: readonly Capa[] = ['plazos', 'citas', 'tareas', 'festivos']

export type RefItem =
  | { tipo: 'evento'; oc: Ocurrencia }
  | { tipo: 'tarea'; tarea: Tarea }
  | { tipo: 'plazo'; orden: Orden; plazo: PlazoCalc }
  | { tipo: 'hito'; orden: Orden; nombre: string }
  | { tipo: 'festivo'; festivo: Festivo }

export interface ItemCal {
  clave: string
  capa: Capa
  fecha: string
  /** Último día (inclusivo) o null */
  fecha_fin: string | null
  hora: string | null
  hora_fin: string | null
  titulo: string
  detalle: string | null
  icono: string
  /** Clase de color: n-vencido… para plazos; e-pendiente/e-hecha… para citas; t-alta… para tareas */
  tono: string
  orden_id: string | null
  ref: RefItem
  /** Se puede arrastrar (solo visitas/citas no repetidas y tareas con fecha) */
  movible: boolean
  hecho: boolean
}

export interface DatosCapas {
  ocurrencias: readonly Ocurrencia[]
  tareas: readonly Tarea[]
  /** Órdenes que pasan los filtros (las que se ven en la tabla) */
  visibles: readonly Orden[]
  /** Todas las órdenes, para poner nombre a lo enlazado */
  todas: ReadonlyMap<string, Orden>
  festivos: readonly Festivo[]
  tipos: ReadonlyMap<string, TipoCita>
  ctx: ContextoPlazos
  filtros: Filtros
  /** Ver solo una orden (#calendario?orden=…) */
  ordenId?: string
}

const ICONO_ESTADO: Record<EstadoEvento, string> = { pendiente: '', hecha: 'check_circle', fallida: 'cancel', cancelada: 'block' }

export function construirItems(d: DatosCapas, capas: ReadonlySet<Capa>, desde: string, hasta: string): ItemCal[] {
  if (!esIso(desde) || !esIso(hasta)) return []
  const visibles = new Set(d.visibles.map((o) => o.id))
  const sinFiltroEstado = d.filtros.filtro === 'todos'
  const q = normal(d.filtros.q.trim())
  const pasa = (ordenId: string | null, textos: (string | null)[]) => {
    if (d.ordenId) return ordenId === d.ordenId
    if (ordenId) return visibles.has(ordenId)
    if (!sinFiltroEstado) return false
    return !q || normal(textos.filter(Boolean).join(' ')).includes(q)
  }
  const out: ItemCal[] = []
  const enRango = (f: string, fin: string | null = null) => f <= hasta && (fin ?? f) >= desde

  if (capas.has('citas')) {
    for (const oc of d.ocurrencias) {
      const e = oc.evento
      if (!enRango(oc.fecha, oc.fecha_fin) || !pasa(e.orden_id, [e.titulo, e.ubicacion, e.notas])) continue
      const o = e.orden_id ? d.todas.get(e.orden_id) : undefined
      const tipo = d.tipos.get(e.tipo)
      out.push({
        clave: 'e:' + oc.clave,
        capa: 'citas',
        fecha: oc.fecha,
        fecha_fin: oc.fecha_fin,
        hora: e.todo_el_dia ? null : e.hora_inicio,
        hora_fin: e.todo_el_dia ? null : e.hora_fin,
        titulo: o ? o.empresa : e.titulo,
        detalle: o ? `${tipo?.nombre ?? e.titulo} · ${o.num_orden}` : (e.ubicacion ?? tipo?.nombre ?? null),
        icono: ICONO_ESTADO[e.estado] || tipo?.icono || 'event',
        tono: `e-${e.estado} t-${e.tipo === 'visita' ? 'visita' : 'cita'}`,
        orden_id: e.orden_id,
        ref: { tipo: 'evento', oc },
        movible: !oc.deSerie && !e.rrule,
        hecho: e.estado !== 'pendiente',
      })
    }
  }
  if (capas.has('tareas')) {
    for (const t of d.tareas) {
      if (!t.vence || !enRango(t.vence) || !pasa(t.orden_id, [t.titulo, t.notas])) continue
      const o = t.orden_id ? d.todas.get(t.orden_id) : undefined
      out.push({
        clave: 't:' + t.id,
        capa: 'tareas',
        fecha: t.vence,
        fecha_fin: null,
        hora: t.hora,
        hora_fin: t.hora && t.duracion_min ? sumarMinutos(t.hora, t.duracion_min) : null,
        titulo: t.titulo,
        detalle: o ? `${o.empresa} · ${o.num_orden}` : null,
        icono: t.hecha ? 'check_box' : 'check_box_outline_blank',
        tono: `t-${t.prioridad}${t.hecha ? ' hecha' : ''}`,
        orden_id: t.orden_id,
        ref: { tipo: 'tarea', tarea: t },
        movible: true,
        hecho: t.hecha,
      })
    }
  }
  const ordenesConPlazos = d.ordenId ? d.visibles.filter((o) => o.id === d.ordenId) : d.visibles
  if (capas.has('plazos')) {
    for (const o of ordenesConPlazos) {
      if (o.estado === 'FINALIZADA') continue
      for (const p of plazosVigilados(o, d.ctx)) {
        if (!enRango(p.fecha)) continue
        out.push({
          clave: `p:${o.id}:${p.regla.id}`,
          capa: 'plazos',
          fecha: p.fecha,
          fecha_fin: null,
          hora: null,
          hora_fin: null,
          titulo: o.empresa,
          detalle: `${p.regla.nombre} · ${o.num_orden}`,
          icono: 'flag',
          tono: `n-${p.nivel}`,
          orden_id: o.id,
          ref: { tipo: 'plazo', orden: o, plazo: p },
          movible: false,
          hecho: false,
        })
      }
    }
  }
  if (capas.has('hitos')) {
    const hitos: [keyof Orden, string][] = [
      ['fecha_orden', 'Fecha de la orden'],
      ['fecha_primera_actuacion', '1.ª actuación'],
      ['fecha_ultima_actuacion', 'Última actuación'],
      ['fecha_cierre', 'Cierre'],
    ]
    for (const o of ordenesConPlazos) {
      for (const [campo, nombre] of hitos) {
        const f = o[campo]
        if (!esIso(f) || !enRango(f)) continue
        out.push({
          clave: `h:${o.id}:${campo}`,
          capa: 'hitos',
          fecha: f,
          fecha_fin: null,
          hora: null,
          hora_fin: null,
          titulo: o.empresa,
          detalle: `${nombre} · ${o.num_orden}`,
          icono: 'history',
          tono: 'hito',
          orden_id: o.id,
          ref: { tipo: 'hito', orden: o, nombre },
          movible: false,
          hecho: false,
        })
      }
    }
  }
  if (capas.has('festivos')) {
    for (const f of d.festivos) {
      if (!enRango(f.fecha)) continue
      out.push({
        clave: 'f:' + f.fecha,
        capa: 'festivos',
        fecha: f.fecha,
        fecha_fin: null,
        hora: null,
        hora_fin: null,
        titulo: f.nombre,
        detalle: 'Festivo',
        icono: 'celebration',
        tono: 'festivo',
        orden_id: null,
        ref: { tipo: 'festivo', festivo: f },
        movible: false,
        hecho: false,
      })
    }
  }
  return out
}

const PESO_CAPA: Record<Capa, number> = { festivos: 0, plazos: 1, citas: 2, tareas: 3, hitos: 4 }

/** Orden dentro de un día: festivos, plazos (los más graves antes), lo de todo el día y luego por hora */
export function compararItems(a: ItemCal, b: ItemCal): number {
  const ha = a.hora ? 1 : 0
  const hb = b.hora ? 1 : 0
  if (ha !== hb) return ha - hb
  if (a.hora && b.hora && a.hora !== b.hora) return a.hora.localeCompare(b.hora)
  return PESO_CAPA[a.capa] - PESO_CAPA[b.capa] || a.titulo.localeCompare(b.titulo, 'es')
}

/** Reparte los items por día (los de varios días salen en cada uno), con un tope de días */
export function porDia(items: readonly ItemCal[], desde: string, hasta: string): Map<string, ItemCal[]> {
  const m = new Map<string, ItemCal[]>()
  const total = Math.min(diasEntre(desde, hasta), 400)
  for (let i = 0; i <= total; i++) m.set(addDias(desde, i), [])
  for (const it of items) {
    let d = it.fecha < desde ? desde : it.fecha
    const fin = it.fecha_fin && it.fecha_fin < hasta ? it.fecha_fin : (it.fecha_fin ?? it.fecha) > hasta ? hasta : (it.fecha_fin ?? it.fecha)
    for (let i = 0; d <= fin && i < 400; i++, d = addDias(d, 1)) m.get(d)?.push(it)
  }
  for (const l of m.values()) l.sort(compararItems)
  return m
}

/** Cuántos hay de cada capa (para el contador del botón) */
export function contarCapas(items: readonly ItemCal[]): Record<Capa, number> {
  const c: Record<Capa, number> = { plazos: 0, citas: 0, tareas: 0, hitos: 0, festivos: 0 }
  for (const i of items) c[i.capa]++
  return c
}

/** El nivel más grave de los plazos de un día (para el punto del mes) */
export function peorNivelDia(items: readonly ItemCal[]): Nivel | null {
  const orden: Nivel[] = ['vencido', 'urgente', 'medio', 'ok']
  let mejor: Nivel | null = null
  for (const i of items) {
    if (i.ref.tipo !== 'plazo') continue
    const n = i.ref.plazo.nivel
    if (!mejor || orden.indexOf(n) < orden.indexOf(mejor)) mejor = n
  }
  return mejor
}

export function sumarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number)
  const t = Math.min(h * 60 + m + min, 23 * 60 + 59)
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

