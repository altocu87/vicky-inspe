import { describe, expect, it } from 'vitest'
import { MAX_TEXTO, textoDemasiadoLargo } from './ordenes'

describe('límites de los textos de una orden', () => {
  it('coinciden con lo que guarda el historial (4000) en los textos largos', () => {
    expect(MAX_TEXTO.situacion_general).toBe(4000)
    expect(MAX_TEXTO.tareas_pendientes).toBe(4000)
  })
  it('detecta el primer texto que no cabe', () => {
    expect(textoDemasiadoLargo({ empresa: 'ACME', situacion_general: 'x'.repeat(4000) })).toBeNull()
    expect(textoDemasiadoLargo({ situacion_general: 'x'.repeat(4001) })).toBe('situacion_general')
    expect(textoDemasiadoLargo({ objeto: 'x'.repeat(501) })).toBe('objeto')
    expect(textoDemasiadoLargo({ objeto: null, empresa: '  ACME  ' })).toBeNull()
  })
})
