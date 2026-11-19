import { describe, expect, it } from 'vitest'
import { ORDEN_VACIA, type Orden } from '../ordenes'
import { contextoBase } from './motor'
import { agruparPlazos, lineasPlazos } from './lista'
import { contarEstados, pasaFiltros } from '../filtros'

const HOY = '2026-11-19' // jueves
const ctx = contextoBase(HOY)
let n = 0
const o = (p: Partial<Orden>): Orden => ({
  ...ORDEN_VACIA,
  id: `id${++n}`,
  num_orden: `N${n}`,
  empresa: 'EMPRESA',
  created_at: '',
  updated_at: '',
  ...p,
})

describe('vista Plazos', () => {
  // 1.ª actuación tal que el límite de 9 meses caiga en la fecha deseada
  const conLimite = (fecha: string, extra: Partial<Orden> = {}) => {
    const [y, m, d] = fecha.split('-').map(Number)
    const f = new Date(y, m - 1 - 9, d)
    const iso = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
    return o({ fecha_primera_actuacion: iso, ...extra })
  }
  const ordenes = [
    conLimite('2026-11-10'), // vencido
    conLimite('2026-11-22'), // domingo de esta semana
    conLimite('2026-11-23'), // lunes siguiente
    o({ fecha_ultima_actuacion: '2026-06-30' }), // «Siguiente» el 30-nov: resto del mes
    conLimite('2027-01-15'), // enero
    conLimite('2026-11-20', { estado: 'FINALIZADA' }), // no sale
  ]

  it('agrupa por semana y mes, con los vencidos arriba', () => {
    const g = agruparPlazos(lineasPlazos(ordenes, ctx), HOY)
    expect(g.map((x) => [x.id, x.lineas.length])).toEqual([
      ['vencidos', 1],
      ['semana', 1],
      ['siguiente', 1],
      ['mes', 1],
      ['2027-01', 1],
    ])
    expect(g[4].titulo).toBe('Enero de 2027')
  })
  it('filtra por nivel, por tipo de plazo y por orden', () => {
    expect(lineasPlazos(ordenes, ctx, { niveles: ['vencido'] })).toHaveLength(1)
    expect(lineasPlazos(ordenes, ctx, { reglas: ['sig'] })).toHaveLength(1)
    expect(lineasPlazos(ordenes, ctx, { ordenId: ordenes[2].id })[0].orden.id).toBe(ordenes[2].id)
  })
})

describe('filtros compartidos', () => {
  const lista = [o({ empresa: 'CAFETERÍA PÉREZ', estado: 'EN CURSO' }), o({ empresa: 'OTRA', estado: 'FINALIZADA' })]
  it('búsqueda sin acentos ni mayúsculas', () => {
    expect(pasaFiltros(lista[0], { q: 'cafeteria perez', filtro: 'todos', ocultarFin: false }, ctx)).toBe(true)
  })
  it('ocultar finalizadas y filtrar por estado', () => {
    expect(pasaFiltros(lista[1], { q: '', filtro: 'todos', ocultarFin: true }, ctx)).toBe(false)
    expect(pasaFiltros(lista[0], { q: '', filtro: 'PTE ENTREGA', ocultarFin: false }, ctx)).toBe(false)
  })
  it('cuenta estados', () => {
    expect(contarEstados(lista, ctx)).toMatchObject({ 'EN CURSO': 1, FINALIZADA: 1 })
  })
})
