import { describe, expect, it } from 'vitest'
import { cuantasConNumero, numeroRepetido, ordinal, repeticionesDeNumero } from './filtros'
import type { Orden } from './ordenes'

const o = (id: string, num_orden: string) => ({ id, num_orden, empresa: 'E' + id }) as Orden
const lista = [o('1', '2/0004814/24'), o('2', 'ÁB-1')]

describe('nº de orden repetido (misma comparación que el servidor MCP)', () => {
  it('detecta el mismo nº aunque cambien mayúsculas, tildes o espacios', () => {
    expect(numeroRepetido(' 2/0004814/24 ', lista)?.id).toBe('1')
    expect(numeroRepetido('ab-1', lista)?.id).toBe('2')
    expect(numeroRepetido('2/0004815/24', lista)).toBeNull()
    expect(numeroRepetido('', lista)).toBeNull()
  })
  it('no cuenta la propia orden ni avisa si el nº no ha cambiado', () => {
    expect(numeroRepetido('2/0004814/24', lista, '1')).toBeNull()
    expect(numeroRepetido('2/0004814/24', [...lista, o('3', '2/0004814/24')], '3', '2/0004814/24')).toBeNull()
    expect(numeroRepetido('AB-1', lista, '1', '2/0004814/24')?.id).toBe('2')
  })
})

describe('repeticionesDeNumero', () => {
  const c = (id: string, num: string, creada: string) => ({ id, num_orden: num, created_at: creada }) as unknown as import('./ordenes').Orden
  it('numera por fecha de creación solo los nº repetidos', () => {
    const r = repeticionesDeNumero([c('b', '2/0002304/25', '2026-02-01'), c('a', ' 2/0002304/25 ', '2026-01-01'), c('x', '2/1/26', '2026-01-01')])
    expect(r.get('a')).toEqual({ n: 1, total: 2 })
    expect(r.get('b')).toEqual({ n: 2, total: 2 })
    expect(r.has('x')).toBe(false)
  })
  it('cuenta cuántas tienen ya el nº y el texto ordinal', () => {
    const l = [c('a', 'A-1', '1'), c('b', 'a-1', '2')]
    expect(cuantasConNumero('A-1', l)).toBe(2)
    expect(cuantasConNumero('A-1', l, 'a')).toBe(1)
    expect(ordinal(3)).toBe('3.ª')
  })
})
