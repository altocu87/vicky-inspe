import { describe, expect, it } from 'vitest'
import { ORDEN_VACIA } from '../ordenes'
import { contextoBase, plazoActivoDe, plazoDe } from './motor'

describe('plazoActivoDe', () => {
  const o = { ...ORDEN_VACIA, estado: 'EN CURSO', fecha_primera_actuacion: '2026-01-15', fecha_ultima_actuacion: '2026-03-01' } as never
  const base = contextoBase('2026-04-01')
  it('con la regla activa da lo mismo que plazoDe', () => {
    expect(plazoActivoDe(o, 'lim9', base)?.fecha).toBe('2026-10-15')
    expect(plazoActivoDe(o, 'sig', base)?.fecha).toBe(plazoDe(o, 'sig', base)?.fecha)
  })
  it('con la regla desactivada en Ajustes no hay fecha (se muestra «—»)', () => {
    const ctx = { ...base, reglas: base.reglas.map((r) => (r.id === 'lim9' ? { ...r, activa: false } : r)) }
    expect(plazoDe(o, 'lim9', ctx)).not.toBeNull()
    expect(plazoActivoDe(o, 'lim9', ctx)).toBeNull()
    expect(plazoActivoDe(o, 'sig', ctx)).not.toBeNull()
  })
})
