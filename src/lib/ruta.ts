// Pantalla actual según el «#» de la dirección: #estadisticas, #ajustes,
// #calendario?vista=mes&fecha=2026-11-19&orden=<id>. Todo lo que llega de la URL se valida.
import { esIso } from './fechas'

export type Pantalla = 'lista' | 'stats' | 'calendario' | 'ajustes'
export const VISTAS_CAL = ['plazos', 'hoy', 'dia', 'semana', 'mes', 'anio'] as const
export type VistaCal = (typeof VISTAS_CAL)[number]

export interface Ruta {
  pantalla: Pantalla
  vista?: VistaCal
  /** Día que se está viendo (aaaa-mm-dd) */
  fecha?: string
  orden?: string
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Solo fechas razonables (evita años absurdos que harían cálculos enormes) */
const fechaValida = (f: string | null): f is string => !!f && esIso(f) && f >= '1990-01-01' && f <= '2100-12-31'

export function leerRuta(hash: string): Ruta {
  const [base, query = ''] = hash.replace(/^#/, '').split('?')
  if (base === 'estadisticas') return { pantalla: 'stats' }
  if (base === 'ajustes') return { pantalla: 'ajustes' }
  if (base === 'calendario') {
    const p = new URLSearchParams(query)
    const v = p.get('vista')
    const o = p.get('orden')
    const f = p.get('fecha')
    const r: Ruta = {
      pantalla: 'calendario',
      vista: (VISTAS_CAL as readonly string[]).includes(v ?? '') ? (v as VistaCal) : undefined,
      orden: o && RE_UUID.test(o) ? o.toLowerCase() : undefined,
    }
    if (fechaValida(f)) r.fecha = f
    return r
  }
  return { pantalla: 'lista' }
}

export function hashDe(r: Ruta): string {
  if (r.pantalla === 'stats') return '#estadisticas'
  if (r.pantalla === 'ajustes') return '#ajustes'
  if (r.pantalla === 'calendario') {
    const p = new URLSearchParams()
    if (r.vista) p.set('vista', r.vista)
    if (r.fecha && fechaValida(r.fecha)) p.set('fecha', r.fecha)
    if (r.orden && RE_UUID.test(r.orden)) p.set('orden', r.orden)
    const q = p.toString()
    return '#calendario' + (q ? '?' + q : '')
  }
  return ''
}
