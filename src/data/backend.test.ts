import { describe, expect, it } from 'vitest'
import { mensajeError, mensajeLogin } from './backend'

describe('mensajes del inicio de sesión', () => {
  it('sin conexión', () => {
    expect(mensajeLogin({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toMatch(/No hay conexión/)
    expect(mensajeLogin({ message: 'TypeError: Load failed' })).toMatch(/No hay conexión/)
  })
  it('demasiados intentos', () => {
    expect(mensajeLogin({ name: 'AuthApiError', status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' })).toMatch(/Demasiados intentos/)
  })
  it('credenciales incorrectas', () => {
    expect(mensajeLogin({ name: 'AuthApiError', status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos')
  })
  it('cualquier otro error: mensaje genérico', () => {
    expect(mensajeLogin({ name: 'AuthApiError', status: 500, message: 'Database error' })).toMatch(/No se pudo entrar/)
  })
})

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
