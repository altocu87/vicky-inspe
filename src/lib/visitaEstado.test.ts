import { describe, expect, it } from 'vitest'
import { hayPropuesta, propuestaAlMarcar, siguienteEstadoVisita } from './visitaEstado'

describe('secuencia del estado de la visita (Excel)', () => {
  it.each([
    ['SIN VISITA', 'fallida', '1º FALLIDA'],
    ['SIN VISITA', 'hecha', 'REALIZADA'],
    [null, 'hecha', 'REALIZADA'],
    ['1º FALLIDA', 'fallida', '1º FALLIDA, 2º FALLIDA'],
    ['1º FALLIDA', 'hecha', '1º FALLIDA, REALIZADA'],
    ['1º FALLIDA, 2º FALLIDA', 'hecha', 'REALIZADA'],
    ['1º FALLIDA, 2º FALLIDA', 'fallida', null],
    ['REALIZADA', 'fallida', null],
    ['1º FALLIDA, REALIZADA', 'hecha', null],
    ['texto libre', 'hecha', null],
  ] as const)('%s + %s → %s', (a, r, d) => expect(siguienteEstadoVisita(a, r)).toBe(d))

  it('propuesta: última actuación solo si es posterior; primera solo si falta', () => {
    const o = { fecha_primera_actuacion: '2026-03-01', fecha_ultima_actuacion: '2026-10-01', estado_visita: 'SIN VISITA' }
    expect(propuestaAlMarcar(o, '2026-11-22', 'hecha', true)).toEqual({
      ultima: { antes: '2026-10-01', despues: '2026-11-22' },
      primera: null,
      estadoVisita: { antes: 'SIN VISITA', despues: 'REALIZADA' },
    })
    expect(propuestaAlMarcar(o, '2026-09-01', 'hecha', false)).toEqual({ ultima: null, primera: null, estadoVisita: null })
    expect(hayPropuesta(propuestaAlMarcar(o, '2026-09-01', 'hecha', false))).toBe(false)
    expect(propuestaAlMarcar({ ...o, fecha_primera_actuacion: null }, '2026-09-01', 'fallida', true).primera).toEqual({ antes: null, despues: '2026-09-01' })
  })
})
