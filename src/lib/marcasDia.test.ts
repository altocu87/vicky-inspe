import { describe, expect, it } from 'vitest'
import { FESTIVOS_ALBACETE } from './festivosAlbacete'
import { mapaFestivos } from './habiles'
import { marcasCabecera, marcasCelda } from './marcasDia'

// FullCalendar 7 entrega la medianoche LOCAL de cada día (en España, todavía el día anterior en UTC)
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d)
const festivos = mapaFestivos(FESTIVOS_ALBACETE)

describe('marcas de los días del calendario (zona Europe/Madrid)', () => {
  it('la prueba corre con hora de España', () => {
    expect(local(2026, 12, 8).getUTCDate()).toBe(7) // si no, la prueba no cazaría el fallo
  })

  it('el festivo del 8 de diciembre se marca el 8, no el 9', () => {
    expect(marcasCelda(local(2026, 12, 8), festivos, '2026-11-23')).toContain('d-festivo')
    expect(marcasCelda(local(2026, 12, 9), festivos, '2026-11-23')).not.toContain('d-festivo')
  })

  it('«Oficina» cae en lunes (7-dic-2026) y no en martes', () => {
    expect(marcasCelda(local(2026, 12, 7), festivos, '2026-11-23')).toContain('d-oficina')
    expect(marcasCelda(local(2026, 12, 8), festivos, '2026-11-23')).not.toContain('d-oficina')
  })

  it('hoy y la cabecera usan el mismo día', () => {
    expect(marcasCelda(local(2026, 11, 23), festivos, '2026-11-23')).toContain('d-hoy')
    expect(marcasCabecera(local(2026, 12, 7), festivos, '2026-11-23')).toBe('dh-oficina dh-visita')
  })
})
