import { describe, expect, it } from 'vitest'
import { leerAuthorizationId, vueltaPermitida } from './oauth'

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
})
