// Pantalla actual según el «#» de la dirección: #estadisticas, #ajustes,
// #calendario?vista=plazos&orden=<id>. Todo lo que llega de la URL se valida.

export type Pantalla = 'lista' | 'stats' | 'calendario' | 'ajustes'
export const VISTAS_CAL = ['plazos'] as const // fase 2: 'hoy', 'dia', 'semana', 'mes', 'anio'
export type VistaCal = (typeof VISTAS_CAL)[number]

export interface Ruta {
  pantalla: Pantalla
  vista?: VistaCal
  orden?: string
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function leerRuta(hash: string): Ruta {
  const [base, query = ''] = hash.replace(/^#/, '').split('?')
  if (base === 'estadisticas') return { pantalla: 'stats' }
  if (base === 'ajustes') return { pantalla: 'ajustes' }
  if (base === 'calendario') {
    const p = new URLSearchParams(query)
    const v = p.get('vista')
    const o = p.get('orden')
    return {
      pantalla: 'calendario',
      vista: (VISTAS_CAL as readonly string[]).includes(v ?? '') ? (v as VistaCal) : undefined,
      orden: o && RE_UUID.test(o) ? o.toLowerCase() : undefined,
    }
  }
  return { pantalla: 'lista' }
}

export function hashDe(r: Ruta): string {
  if (r.pantalla === 'stats') return '#estadisticas'
  if (r.pantalla === 'ajustes') return '#ajustes'
  if (r.pantalla === 'calendario') {
    const p = new URLSearchParams()
    if (r.vista) p.set('vista', r.vista)
    if (r.orden && RE_UUID.test(r.orden)) p.set('orden', r.orden)
    const q = p.toString()
    return '#calendario' + (q ? '?' + q : '')
  }
  return ''
}
