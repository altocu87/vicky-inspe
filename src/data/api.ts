// ÚNICO módulo que lee y escribe datos. Las pantallas nunca llaman a Supabase directamente.
// En desarrollo, con VITE_DEMO=1, usa datos de ejemplo en memoria (nunca en producción:
// import.meta.env.DEV es `false` al compilar, así que el modo demo ni siquiera se incluye).
import type { Backend } from './backend'

export type { Backend, Conexion, DetallesPermiso, Resultado } from './backend'
export { mensajeError } from './backend'

export const MODO_DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO === '1'

let backend: Promise<Backend> | null = null

/** Carga el backend una sola vez (Supabase, o el de demo en desarrollo) */
export function api(): Promise<Backend> {
  if (!backend) {
    backend = MODO_DEMO ? import('./demo').then((m) => m.backendDemo) : import('./supabaseBackend').then((m) => m.backendSupabase)
  }
  return backend
}
