// Recarga automática cuando falla la descarga de un trozo de la app (pasa tras publicar una
// versión nueva en Vercel: una pestaña abierta pide archivos antiguos que ya no existen).
// Para no entrar en un bucle de recargas, se apunta en sessionStorage cuándo se recargó por
// última vez: si fue hace poco, no se vuelve a recargar y se enseña la pantalla de error.

export const CLAVE_RECARGA = 'inspe:recarga-auto'
/** Tiempo mínimo entre dos recargas automáticas */
export const ESPERA_RECARGA_MS = 30_000

type Almacen = Pick<Storage, 'getItem' | 'setItem'>

function almacen(): Almacen | null {
  try {
    return window.sessionStorage
  } catch {
    return null // navegación privada o almacenamiento bloqueado
  }
}

/**
 * Apunta la recarga y devuelve true si se puede recargar ya; false si ya se recargó hace
 * menos de ESPERA_RECARGA_MS (o si no hay dónde apuntarlo: mejor no arriesgar un bucle).
 */
export function puedeRecargar(ahora = Date.now(), a: Almacen | null = almacen()): boolean {
  if (!a) return false
  try {
    const antes = Number(a.getItem(CLAVE_RECARGA))
    if (Number.isFinite(antes) && antes > 0 && ahora - antes >= 0 && ahora - antes < ESPERA_RECARGA_MS) return false
    a.setItem(CLAVE_RECARGA, String(ahora))
    return true
  } catch {
    return false
  }
}

/** true si el error es de «no se pudo descargar un trozo de la app» */
export function esErrorDeCarga(e: unknown): boolean {
  const m = e instanceof Error ? `${e.name} ${e.message}` : String(e)
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk/i.test(m)
}

/** Recarga la página si no se ha hecho hace poco. Devuelve true si va a recargar. */
export function recargarSiSePuede(): boolean {
  if (!puedeRecargar()) return false
  window.location.reload()
  return true
}

/** Escucha el aviso de Vite cuando falla la carga de un trozo y recarga (una vez) */
export function vigilarVersionNueva(): void {
  window.addEventListener('vite:preloadError', (ev) => {
    // preventDefault evita que el error llegue a la app; solo si de verdad vamos a recargar
    if (recargarSiSePuede()) ev.preventDefault()
  })
}
