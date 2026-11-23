import { describe, expect, it } from 'vitest'
import { numeroRepetido } from './filtros'
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
