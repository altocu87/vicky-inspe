import { describe, expect, it } from 'vitest'
import { leerEvento } from './eventos'
import { conHasta, desplegar, diasDeSerie, hastaDe, nombreRepeticion } from './repeticion'

const ev = (p: Record<string, unknown>) =>
  leerEvento({ id: '00000000-0000-4000-8000-000000000001', titulo: 'x', tipo: 'visita', fecha: '2026-11-02', estado: 'pendiente', ...p })!

describe('repeticiones', () => {
  it('semanal en lunes, en hora de España (incluido el cambio de hora)', () => {
    expect(diasDeSerie('2027-03-22', 'FREQ=WEEKLY', '2027-03-20', '2027-04-06')).toEqual(['2027-03-22', '2027-03-29', '2027-04-05'])
    expect(diasDeSerie('2026-10-19', 'FREQ=WEEKLY', '2026-10-19', '2026-11-02')).toEqual(['2026-10-19', '2026-10-26', '2026-11-02'])
  })
  it('mensual el 31 se salta los meses cortos (como RFC 5545)', () => {
    expect(diasDeSerie('2027-01-31', 'FREQ=MONTHLY', '2027-01-01', '2027-05-31')).toEqual(['2027-01-31', '2027-03-31', '2027-05-31'])
  })
  it('respeta UNTIL y el tope', () => {
    expect(diasDeSerie('2026-11-01', conHasta('FREQ=DAILY', '2026-11-03'), '2026-10-01', '2026-12-31')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(diasDeSerie('2000-01-01', 'FREQ=DAILY', '2000-01-01', '2100-01-01', 50)).toHaveLength(50)
    expect(diasDeSerie('2026-11-01', 'FREQ=DAILY;DTSTART=1', '2026-11-01', '2026-11-30')).toEqual([])
  })
  it('desplegar quita días quitados y los sustituidos por una excepción', () => {
    const serie = ev({ rrule: 'FREQ=WEEKLY', exdates: ['2026-11-09'] })
    const excepcion = ev({ id: '00000000-0000-4000-8000-000000000002', fecha: '2026-11-17', serie_id: serie.id, ocurrencia_original: '2026-11-16' })
    const o = desplegar([serie, excepcion], '2026-11-01', '2026-11-30')
    expect(o.map((x) => `${x.fecha}${x.deSerie ? '*' : ''}`)).toEqual(['2026-11-02*', '2026-11-17*', '2026-11-23*', '2026-11-30*'])
    expect(o[0].clave).toBe(`${serie.id}@2026-11-02`)
  })
  it('evento normal que dura varios días y empieza antes del rango', () => {
    const e = ev({ todo_el_dia: true, fecha: '2026-10-30', fecha_fin: '2026-11-02' })
    expect(desplegar([e], '2026-11-01', '2026-11-30')).toHaveLength(1)
    expect(desplegar([e], '2026-11-03', '2026-11-30')).toHaveLength(0)
  })
  it('nombres y fin', () => {
    expect(nombreRepeticion('FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231')).toBe('Cada 2 semanas')
    expect(nombreRepeticion('FREQ=WEEKLY;BYDAY=SU')).toBe('Personalizada')
    expect(hastaDe('FREQ=DAILY;UNTIL=20261231')).toBe('2026-12-31')
    expect(conHasta('FREQ=DAILY;UNTIL=20261231', null)).toBe('FREQ=DAILY')
  })
})
