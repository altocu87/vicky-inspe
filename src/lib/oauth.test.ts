import { describe, expect, it } from 'vitest'
import { clientePermitido, leerAuthorizationId, leerClientesPermitidos, vueltaPermitida } from './oauth'

describe('pantalla de permiso de ChatGPT', () => {
  it('solo deja volver a ChatGPT por https', () => {
    expect(vueltaPermitida('https://chatgpt.com/connector_platform_oauth_redirect?code=x&state=y')).toBe(true)
    expect(vueltaPermitida('https://chatgpt.com/connector/oauth/abc123')).toBe(true)
    for (const u of [
      'http://chatgpt.com/x',
      'https://chatgpt.com.malo.com/x',
      'https://malo.com/?r=https://chatgpt.com',
      'https://user:pass@chatgpt.com/x',
      'javascript:alert(1)',
      'https://evil.example/cb',
      'no es una url',
    ])
      expect(vueltaPermitida(u), u).toBe(false)
  })
  it('localhost solo en desarrollo (para probar con MCP Inspector)', () => {
    expect(vueltaPermitida('http://localhost:6274/oauth/callback')).toBe(false)
    expect(vueltaPermitida('http://localhost:6274/oauth/callback', true)).toBe(true)
  })
  it('el id de la solicitud se valida', () => {
    expect(leerAuthorizationId('?authorization_id=abcd1234-ef')).toBe('abcd1234-ef')
    expect(leerAuthorizationId('?authorization_id=<script>')).toBeNull()
    expect(leerAuthorizationId('')).toBeNull()
  })
  it('solo se acepta el asistente cuyo id está en la lista (VITE_OAUTH_CLIENTES)', () => {
    const lista = leerClientesPermitidos(' abc-123 , def-456,,')
    expect(lista).toEqual(['abc-123', 'def-456'])
    expect(clientePermitido('abc-123', lista)).toBe(true)
    expect(clientePermitido('otro', lista)).toBe(false)
    expect(clientePermitido('', lista)).toBe(false)
    expect(clientePermitido(undefined, lista)).toBe(false)
    // Lista vacía: ninguno (hay que configurarla antes de conectar)
    expect(leerClientesPermitidos(undefined)).toEqual([])
    expect(clientePermitido('abc-123', leerClientesPermitidos(''))).toBe(false)
  })
})
