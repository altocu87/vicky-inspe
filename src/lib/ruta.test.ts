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
  it('ida y vuelta', () => {
    expect(hashDe({ pantalla: 'calendario', vista: 'plazos', orden: ID })).toBe(`#calendario?vista=plazos&orden=${ID}`)
    expect(leerRuta(hashDe({ pantalla: 'calendario', orden: ID }))).toEqual({ pantalla: 'calendario', vista: undefined, orden: ID })
  })
})
