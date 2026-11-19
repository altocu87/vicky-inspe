import { describe, expect, it } from 'vitest'
import { addDias, diaSemana, diasEntre, edate, esIso, finDeMes, lunesDe, parse, toIso } from './fechas'
import { finExclusivo, finInclusivo } from './todoElDia'

describe('zona horaria', () => {
  it('las pruebas corren con la hora de España', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-120)
  })
  it('toIso usa el día LOCAL (toISOString daría el anterior a medianoche)', () => {
    const medianoche = new Date(2026, 10, 19, 0, 30)
    expect(toIso(medianoche)).toBe('2026-11-19')
    expect(medianoche.toISOString().slice(0, 10)).toBe('2026-11-18') // la trampa
  })
})

describe('edate (EDATE de Excel)', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'],
    ['2026-03-31', 9, '2026-12-31'],
    ['2026-05-31', 9, '2027-02-28'],
    ['2026-08-31', 5, '2027-01-31'],
    ['2026-09-30', 5, '2027-02-28'],
    ['2026-11-19', 9, '2027-08-19'],
    ['2026-12-15', -1, '2026-11-15'],
  ])('%s + %i meses = %s', (d, m, r) => expect(edate(d, m)).toBe(r))
})

describe('utilidades', () => {
  it('esIso solo acepta fechas reales', () => {
    expect(esIso('2026-02-28')).toBe(true)
    expect(esIso('2026-02-30')).toBe(false)
    expect(esIso('19/11/2026')).toBe(false)
    expect(esIso(null)).toBe(false)
  })
  it('diasEntre no se rompe con el cambio de hora', () => {
    expect(diasEntre('2026-03-28', '2026-03-30')).toBe(2)
    expect(diasEntre('2026-10-24', '2026-10-26')).toBe(2)
    expect(addDias('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDias('2026-10-25', 1)).toBe('2026-10-26')
  })
  it('semana de lunes a domingo', () => {
    expect(lunesDe('2026-11-19')).toBe('2026-11-16') // jueves
    expect(lunesDe('2026-11-22')).toBe('2026-11-16') // domingo
    expect(lunesDe('2026-11-16')).toBe('2026-11-16') // lunes
    expect(diaSemana('2026-11-22')).toBe(0)
  })
  it('fin de mes', () => {
    expect(finDeMes('2028-02-10')).toBe('2028-02-29')
    expect(toIso(parse('2026-12-31'))).toBe('2026-12-31')
  })
})

describe('todo el día: fin exclusivo (FullCalendar) ↔ inclusivo (base de datos)', () => {
  it('del 3 al 5 se guarda con fin 5 y FullCalendar lo da con fin 6', () => {
    expect(finExclusivo('2026-11-03', '2026-11-05')).toBe('2026-11-06')
    expect(finInclusivo('2026-11-03', '2026-11-06')).toBe('2026-11-05')
  })
  it('un solo día', () => {
    expect(finExclusivo('2026-11-03', null)).toBe('2026-11-04')
    expect(finInclusivo('2026-11-03', '2026-11-04')).toBe('2026-11-03')
    expect(finInclusivo('2026-11-03', undefined)).toBe('2026-11-03')
  })
  it('ida y vuelta conserva el valor, también al cambiar de mes y de año', () => {
    for (const [i, f] of [
      ['2026-12-30', '2027-01-02'],
      ['2028-02-28', '2028-03-01'],
      ['2026-10-24', '2026-10-26'],
    ])
      expect(finInclusivo(i, finExclusivo(i, f))).toBe(f)
  })
  it('un fin anterior al inicio se corrige al propio inicio', () => {
    expect(finInclusivo('2026-11-03', '2026-11-01')).toBe('2026-11-03')
    expect(finExclusivo('2026-11-03', '2026-11-01')).toBe('2026-11-04')
  })
})
