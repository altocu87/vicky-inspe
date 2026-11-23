import { describe, expect, it } from 'vitest'
import { celdaCsv, celdaSegura } from './csv'

describe('celdaSegura (inyección de fórmulas)', () => {
  it('neutraliza los caracteres de fórmula al inicio', () => {
    for (const s of ['=1+1', '+34 600', '-2', '@SUMA(A1)', '\tx', '\rx']) expect(celdaSegura(s)).toBe("'" + s)
  })
  it('neutraliza un = precedido de espacios', () => {
    expect(celdaSegura('  =HYPERLINK("x")')).toBe("'  =HYPERLINK(\"x\")")
    expect(celdaSegura('  +1')).toBe("'  +1")
  })
  it('neutraliza los signos de ancho completo', () => {
    for (const s of ['＝1', '＋1', '－1', '＠a', ' ＝1']) expect(celdaSegura(s)).toBe("'" + s)
  })
  it('deja intacto el texto normal', () => {
    for (const s of ['', 'Empresa S.L.', '12/03/2026', 'a=b', '  hola']) expect(celdaSegura(s)).toBe(s)
  })
})

describe('celdaCsv', () => {
  it('entrecomilla separadores y comillas', () => {
    expect(celdaCsv('a;b')).toBe('"a;b"')
    expect(celdaCsv('di "hola"')).toBe('"di ""hola"""')
    expect(celdaCsv('=a;b')).toBe(`"'=a;b"`)
  })
})
