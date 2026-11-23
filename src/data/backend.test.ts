import { describe, expect, it } from 'vitest'
import { mensajeError } from './backend'

describe('mensajeError: sesión caducada', () => {
  const caducada = 'Tu sesión ha caducado. Vuelve a entrar.'
  it('reconoce los avisos de sesión caducada', () => {
    expect(mensajeError({ code: 'PGRST301', message: 'JWSError' })).toBe(caducada)
    expect(mensajeError({ code: 'PGRST303', message: 'JWT expired' })).toBe(caducada)
    expect(mensajeError({ message: 'JWT expired' })).toBe(caducada)
    expect(mensajeError({ status: 401, message: 'Unauthorized' })).toBe(caducada)
    expect(mensajeError({ code: 'session_expired', message: 'x' })).toBe(caducada)
  })
  it('el resto de errores sigue igual', () => {
    expect(mensajeError({ code: '23505', message: 'duplicate' })).toBe('Ya existe un registro igual.')
    expect(mensajeError({ code: '42501', message: 'permission denied' })).toBe('No tienes permiso para esta acción. Vuelve a iniciar sesión.')
    expect(mensajeError(null)).toBe('Error desconocido')
  })
})
