import { describe, expect, it } from 'vitest'
import { FESTIVOS_ALBACETE } from './festivosAlbacete'
import { esHabil, mapaFestivos, motivoInhabil, sumarHabiles, SIN_FESTIVOS } from './habiles'

const F = mapaFestivos(FESTIVOS_ALBACETE)

describe('días hábiles', () => {
  it('sábados, domingos y festivos no son hábiles', () => {
    expect(esHabil('2026-11-21', F)).toBe(false) // sábado
    expect(esHabil('2026-11-22', F)).toBe(false) // domingo
    expect(esHabil('2026-12-08', F)).toBe(false) // Inmaculada (martes)
    expect(esHabil('2026-11-23', F)).toBe(true) // lunes
  })
  it('motivo del día inhábil', () => {
    expect(motivoInhabil('2026-11-21', F)).toEqual({ motivo: 'sábado' })
    expect(motivoInhabil('2026-11-22', F)).toEqual({ motivo: 'domingo' })
    expect(motivoInhabil('2027-05-31', F)).toEqual({ motivo: 'festivo', nombre: 'Día de Castilla-La Mancha' })
    expect(motivoInhabil('2026-11-23', F)).toBeNull()
  })
  it('se empieza a contar al día siguiente y se saltan fines de semana', () => {
    expect(sumarHabiles('2026-11-19', 1, SIN_FESTIVOS)).toBe('2026-11-20') // jue → vie
    expect(sumarHabiles('2026-11-19', 2, SIN_FESTIVOS)).toBe('2026-11-23') // → lunes
    expect(sumarHabiles('2026-11-21', 1, SIN_FESTIVOS)).toBe('2026-11-23') // desde sábado
    expect(sumarHabiles('2026-11-19', 10, SIN_FESTIVOS)).toBe('2026-12-03')
  })
  it('se saltan los festivos (puente de diciembre)', () => {
    // vie 4-dic-2026 + 2 hábiles: lun 7 (hábil), mar 8 festivo → mié 9
    expect(sumarHabiles('2026-12-04', 2, F)).toBe('2026-12-09')
    // Semana Santa 2027: mié 24-mar + 1 → jue 25 y vie 26 festivos, finde → lun 29
    expect(sumarHabiles('2027-03-24', 1, F)).toBe('2027-03-29')
  })
  it('n = 0 devuelve el mismo día; n negativo cuenta hacia atrás', () => {
    expect(sumarHabiles('2026-11-22', 0, F)).toBe('2026-11-22')
    expect(sumarHabiles('2026-11-23', -1, F)).toBe('2026-11-20')
  })
  it('rechaza valores absurdos', () => {
    expect(() => sumarHabiles('2026-11-19', 1.5, F)).toThrow()
    expect(() => sumarHabiles('2026-11-19', 100000, F)).toThrow()
  })
})
