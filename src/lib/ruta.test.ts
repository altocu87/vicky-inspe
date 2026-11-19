import { describe, expect, it } from 'vitest'
import { hashDe, leerRuta } from './ruta'

const ID = '00000000-0000-4000-8000-000000000001'

describe('ruta por el # de la dirección', () => {
  it('pantallas conocidas', () => {
    expect(leerRuta('')).toEqual({ pantalla: 'lista' })
    expect(leerRuta('#estadisticas')).toEqual({ pantalla: 'stats' })
    expect(leerRuta('#ajustes')).toEqual({ pantalla: 'ajustes' })
    expect(leerRuta(`#calendario?vista=plazos&orden=${ID}`)).toEqual({ pantalla: 'calendario', vista: 'plazos', orden: ID })
  })
  it('ignora valores manipulados', () => {
    expect(leerRuta('#calendario?orden=<script>&vista=../../x')).toEqual({ pantalla: 'calendario', vista: undefined, orden: undefined })
    expect(leerRuta("#calendario?orden=1' or '1'='1")).toMatchObject({ orden: undefined })
    expect(leerRuta('#loquesea')).toEqual({ pantalla: 'lista' })
  })
  it('vista y fecha del calendario', () => {
    expect(leerRuta('#calendario?vista=mes&fecha=2026-11-19')).toEqual({ pantalla: 'calendario', vista: 'mes', fecha: '2026-11-19', orden: undefined })
    expect(leerRuta('#calendario?vista=anio&fecha=2026-02-30').fecha).toBeUndefined()
    expect(leerRuta('#calendario?fecha=99999-01-01').fecha).toBeUndefined()
    expect(leerRuta('#calendario?fecha=1200-01-01').fecha).toBeUndefined()
    expect(hashDe({ pantalla: 'calendario', vista: 'semana', fecha: '2026-11-19' })).toBe('#calendario?vista=semana&fecha=2026-11-19')
    expect(hashDe({ pantalla: 'calendario', vista: 'dia', fecha: 'mañana' })).toBe('#calendario?vista=dia')
  })
  it('ida y vuelta', () => {
    expect(hashDe({ pantalla: 'calendario', vista: 'plazos', orden: ID })).toBe(`#calendario?vista=plazos&orden=${ID}`)
    expect(leerRuta(hashDe({ pantalla: 'calendario', orden: ID }))).toEqual({ pantalla: 'calendario', vista: undefined, orden: ID })
  })
})
