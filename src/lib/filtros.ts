// Filtros compartidos por la tabla, las tarjetas y el calendario (un solo estado, una sola lógica).
import { ESTADOS, type Estado, type Orden } from './ordenes'
import { peorNivelDe, type ContextoPlazos, type Nivel } from './plazos/motor'

export type Filtro = 'todos' | 'urgentes' | 'sintiempo' | Estado

export interface Filtros {
  q: string
  filtro: Filtro
  ocultarFin: boolean
}

export const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function nivelOrden(o: Orden, ctx: ContextoPlazos): Nivel | null {
  return o.estado === 'FINALIZADA' ? null : peorNivelDe(o, ctx)
}

/** ¿La orden pasa los filtros? */
export function pasaFiltros(o: Orden, f: Filtros, ctx: ContextoPlazos): boolean {
  if (f.ocultarFin && o.estado === 'FINALIZADA') return false
  if (f.filtro === 'urgentes' && nivelOrden(o, ctx) !== 'urgente') return false
  if (f.filtro === 'sintiempo' && nivelOrden(o, ctx) !== 'vencido') return false
  if ((ESTADOS as readonly string[]).includes(f.filtro) && o.estado !== f.filtro) return false
  const t = normal(f.q.trim())
  if (!t) return true
  return normal([o.num_orden, o.empresa, o.objeto, o.situacion_general, o.tareas_pendientes, o.fecha_visita].join(' ')).includes(t)
}

export function contarEstados(ordenes: readonly Orden[], ctx: ContextoPlazos) {
  const s = { 'EN CURSO': 0, 'PTE ENTREGA': 0, FINALIZADA: 0, urgentes: 0, sintiempo: 0 }
  for (const o of ordenes) {
    if (o.estado in s) s[o.estado]++
    const n = nivelOrden(o, ctx)
    if (n === 'urgente') s.urgentes++
    if (n === 'vencido') s.sintiempo++
  }
  return s
}

/** Etiqueta del filtro para el texto «N órdenes · …» */
export function nombreFiltro(f: Filtro): string {
  if (f === 'urgentes') return 'Menos de 30 días'
  if (f === 'sintiempo') return 'Sin tiempo'
  if (f === 'EN CURSO') return 'En curso'
  if (f === 'PTE ENTREGA') return 'Pte. entrega'
  if (f === 'FINALIZADA') return 'Finalizada'
  return ''
}
