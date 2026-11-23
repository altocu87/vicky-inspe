import { describe, expect, it } from 'vitest'
import { mensajeLogin } from './backend'

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
