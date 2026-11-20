// Pantalla de permiso para conectar ChatGPT (OAuth 2.1 de Supabase Auth).
// Para que el acceso sea PRIVADO: solo se acepta volver a ChatGPT (chatgpt.com). Si alguien intentara
// usar la pantalla para otro programa, se rechaza aunque tenga usuario.

/** Dominios a los que se permite volver tras dar permiso (los de ChatGPT) */
export const DOMINIOS_PERMITIDOS = ['chatgpt.com', 'chat.openai.com'] as const

/** ¿Es una dirección de vuelta de ChatGPT? (https y dominio exacto; en desarrollo, también localhost para probar) */
export function vueltaPermitida(url: string, desarrollo = false): boolean {
  try {
    const u = new URL(url)
    if (u.username || u.password) return false
    if (desarrollo && u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return true
    return u.protocol === 'https:' && (DOMINIOS_PERMITIDOS as readonly string[]).includes(u.hostname)
  } catch {
    return false
  }
}

/** El id de la solicitud que manda Supabase en la dirección (?authorization_id=…), validado */
export function leerAuthorizationId(search: string): string | null {
  const v = new URLSearchParams(search).get('authorization_id')
  return v && /^[A-Za-z0-9_-]{8,200}$/.test(v) ? v : null
}

export const RUTA_PERMISO = '/oauth/consent'
