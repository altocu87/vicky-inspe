import { describe, expect, it } from 'vitest'
import { CLAVE_RECARGA, ESPERA_RECARGA_MS, esErrorDeCarga, puedeRecargar } from './recarga'

function memoria() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

describe('recarga automática tras publicar una versión nueva', () => {
  it('recarga la primera vez y apunta cuándo', () => {
    const a = memoria()
    expect(puedeRecargar(1_000_000, a)).toBe(true)
    expect(a.m.get(CLAVE_RECARGA)).toBe('1000000')
  })

  it('no recarga otra vez enseguida (sin bucles)', () => {
    const a = memoria()
    puedeRecargar(1_000_000, a)
    expect(puedeRecargar(1_000_000 + 5_000, a)).toBe(false)
    expect(puedeRecargar(1_000_000 + ESPERA_RECARGA_MS, a)).toBe(true)
  })

  it('sin almacenamiento (o si falla) no recarga', () => {
    expect(puedeRecargar(1, null)).toBe(false)
    const roto = { getItem: () => { throw new Error('bloqueado') }, setItem: () => {} }
    expect(puedeRecargar(1, roto)).toBe(false)
  })

  it('reconoce los errores de descarga de trozos', () => {
    expect(esErrorDeCarga(new TypeError('Failed to fetch dynamically imported module: https://x/assets/VistaFC-abc.js'))).toBe(true)
    expect(esErrorDeCarga(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(esErrorDeCarga(new Error('Cannot read properties of undefined'))).toBe(false)
  })
})
