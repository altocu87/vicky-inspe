import { describe, expect, it } from 'vitest'
import { cerradaDentroDe9Meses } from './estadisticas'

describe('cerradaDentroDe9Meses', () => {
  it('31 de mayo + 9 meses = 28 de febrero (ajusta a fin de mes)', () => {
    expect(cerradaDentroDe9Meses('2025-05-31', '2026-02-28')).toBe(true)
    expect(cerradaDentroDe9Meses('2025-05-31', '2026-03-01')).toBe(false)
    expect(cerradaDentroDe9Meses('2025-05-31', '2026-03-02')).toBe(false)
  })
  it('el mismo día límite cuenta como dentro', () => {
    expect(cerradaDentroDe9Meses('2026-01-15', '2026-10-15')).toBe(true)
    expect(cerradaDentroDe9Meses('2026-01-15', '2026-10-16')).toBe(false)
  })
  it('cruce de horario de verano sin desfases', () => {
    expect(cerradaDentroDe9Meses('2026-06-30', '2027-03-30')).toBe(true)
    expect(cerradaDentroDe9Meses('2026-06-30', '2027-03-31')).toBe(false)
  })
  it('fechas no válidas → no cuenta', () => {
    expect(cerradaDentroDe9Meses('', '2026-01-01')).toBe(false)
  })
})
