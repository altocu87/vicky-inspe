import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_TEXTO, fechaCierreAlGuardar, textoDemasiadoLargo } from './ordenes'

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

describe('fecha de cierre al finalizar desde la web', () => {
  afterEach(() => vi.useRealTimers())
  it('sin fecha: la de hoy en España, también pasada la medianoche (en UTC aún es ayer)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-23T23:30:00Z')) // 00:30 del 24 en Madrid
    expect(fechaCierreAlGuardar('FINALIZADA', null)).toBe('2026-11-24')
    vi.setSystemTime(new Date('2026-07-14T22:15:00Z')) // 00:15 del 15 en verano
    expect(fechaCierreAlGuardar('FINALIZADA', '')).toBe('2026-07-15')
  })
  it('respeta la fecha puesta y la quita si no está finalizada', () => {
    expect(fechaCierreAlGuardar('FINALIZADA', '2026-10-01')).toBe('2026-10-01')
    expect(fechaCierreAlGuardar('EN CURSO', '2026-10-01')).toBeNull()
  })
})
