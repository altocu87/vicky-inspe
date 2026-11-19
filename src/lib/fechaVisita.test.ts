import { describe, expect, it } from 'vitest'
import { claveExcel, convertirFechaVisita as c, simularConversion, tituloVisitaExcel } from './fechaVisita'

const HOY = '2026-11-19'

describe('conversión de fecha_visita (Excel)', () => {
  it('nada que convertir', () => {
    expect(c(null, 'SIN VISITA', HOY)).toEqual({ tipo: 'vacio' })
    expect(c('  NO VISITA ', 'SIN VISITA', HOY)).toEqual({ tipo: 'vacio' })
  })
  it('encaja con la secuencia del estado', () => {
    expect(c('03/02/2025 17/03/2025', '1º FALLIDA, REALIZADA', HOY)).toEqual({
      tipo: 'ok',
      segunSecuencia: true,
      notas: null,
      visitas: [
        { fecha: '2025-02-03', estado: 'fallida' },
        { fecha: '2025-03-17', estado: 'hecha' },
      ],
    })
    expect(c('14/04/2025', 'REALIZADA', HOY)).toMatchObject({ visitas: [{ estado: 'hecha' }], segunSecuencia: true })
    // fechas desordenadas y repetidas
    expect(c('17/03/2025, 03/02/2025, 03/02/2025', '1º FALLIDA, 2º FALLIDA', HOY)).toMatchObject({
      visitas: [{ fecha: '2025-02-03', estado: 'fallida' }, { fecha: '2025-03-17', estado: 'fallida' }],
    })
  })
  it('una fecha más que la secuencia y futura → pendiente', () => {
    expect(c('03/10/2026 30/11/2026', '1º FALLIDA', HOY)).toMatchObject({
      segunSecuencia: true,
      visitas: [{ estado: 'fallida' }, { fecha: '2026-11-30', estado: 'pendiente' }],
    })
  })
  it('no encaja → futuras pendientes y pasadas hechas', () => {
    expect(c('01/01/2026 30/11/2026', 'SIN VISITA', HOY)).toEqual({
      tipo: 'ok',
      segunSecuencia: false,
      notas: null,
      visitas: [
        { fecha: '2026-01-01', estado: 'hecha' },
        { fecha: '2026-11-30', estado: 'pendiente' },
      ],
    })
  })
  it('casos del Excel que se entienden (decididos con la usuaria)', () => {
    // «1º visita … 2º visita el …», con fechas dd-mm-aa: las dos, hechas, y el texto en los detalles
    expect(c('1º visita 19-11-24; 2º visita el 3-12-24', 'REALIZADA', HOY)).toEqual({
      tipo: 'ok',
      segunSecuencia: false,
      notas: 'Texto del Excel: «1º visita 19-11-24; 2º visita el 3-12-24»',
      visitas: [
        { fecha: '2024-11-19', estado: 'hecha' },
        { fecha: '2024-12-03', estado: 'hecha' },
      ],
    })
    // día de una cifra
    expect(c('9/05/2026 29/06/2026', '1º FALLIDA, REALIZADA', HOY)).toMatchObject({
      notas: null,
      visitas: [
        { fecha: '2026-05-09', estado: 'fallida' },
        { fecha: '2026-06-29', estado: 'hecha' },
      ],
    })
    // «FALLIDA» detrás de la fecha manda
    expect(c('14/04/2025 FALLIDA', 'REALIZADA', HOY)).toMatchObject({ notas: 'Texto del Excel: «14/04/2025 FALLIDA»', visitas: [{ fecha: '2025-04-14', estado: 'fallida' }] })
    expect(c('14/04/2025 fallida, 20/05/2025', 'REALIZADA', HOY)).toMatchObject({ visitas: [{ estado: 'fallida' }, { estado: 'hecha' }] })
  })
  it('casos dudosos (a revisar a mano)', () => {
    expect(c('FALLIDA', 'REALIZADA', HOY)).toEqual({ tipo: 'dudoso', motivo: 'No hay ninguna fecha' })
    expect(c('31/02/2025', 'REALIZADA', HOY)).toEqual({ tipo: 'dudoso', motivo: 'Fecha imposible: 31/02/2025' })
    expect(c('14/04/2025 llamar antes', 'REALIZADA', HOY)).toEqual({ tipo: 'dudoso', motivo: 'Hay texto que no se entiende' })
    expect(c('123/04/2025', 'REALIZADA', HOY).tipo).toBe('dudoso')
  })
  it('simulación y clave única', () => {
    const r = simularConversion(
      [
        { id: 'a', num_orden: '1', fecha_visita: '14/04/2025', estado_visita: 'REALIZADA' },
        { id: 'b', num_orden: '2', fecha_visita: 'NO VISITA', estado_visita: 'SIN VISITA' },
        { id: 'c', num_orden: '3', fecha_visita: 'FALLIDA', estado_visita: 'REALIZADA' },
      ],
      HOY,
    )
    expect(r).toMatchObject({ conFechas: 1, visitas: 1, segunSecuencia: 1, porEstado: { hecha: 1 } })
    expect(r.dudosos.map((d) => d.num_orden)).toEqual(['3'])
    expect(claveExcel('a', '2025-04-14')).toBe('excel:a:2025-04-14')
    expect([tituloVisitaExcel(1, 1), tituloVisitaExcel(1, 2), tituloVisitaExcel(2, 2)]).toEqual(['Visita (Excel)', '1ª visita (Excel)', '2ª visita (Excel)'])
  })
})
