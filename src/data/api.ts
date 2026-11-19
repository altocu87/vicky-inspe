// ÚNICO módulo que lee y escribe datos. Las pantallas nunca llaman a Supabase directamente.
// En desarrollo, con VITE_DEMO=1, usa datos de ejemplo en memoria (nunca en producción:
// import.meta.env.DEV es `false` al compilar, así que el modo demo ni siquiera se incluye).
import type { Session } from '@supabase/supabase-js'
import type { Orden } from '../lib/ordenes'
import type { Festivo } from '../lib/habiles'
import type { ReglaFila } from '../lib/plazos/reglas'
import type { Evento, EventoInput, TipoCita } from '../lib/eventos'
import type { Tarea, TareaInput } from '../lib/tareas'
import type { CambioHistorial } from '../lib/historial'

export type Resultado<T> = { data: T; error: null } | { data: null; error: string }

export interface Backend {
  sesion(): Promise<Session | null>
  alCambiarSesion(fn: (s: Session | null) => void): () => void
  entrar(email: string, password: string): Promise<string | null>
  salir(): Promise<void>
  listarOrdenes(): Promise<Resultado<Orden[]>>
  crearOrden(payload: Partial<Orden>): Promise<Resultado<Orden>>
  actualizarOrden(id: string, payload: Partial<Orden>): Promise<Resultado<Orden>>
  eliminarOrden(id: string): Promise<string | null>
  listarFestivos(desde: string, hasta: string): Promise<Resultado<Festivo[]>>
  guardarFestivo(f: Festivo): Promise<string | null>
  eliminarFestivo(fecha: string): Promise<string | null>
  listarReglas(): Promise<Resultado<ReglaFila[]>>
  guardarRegla(r: Partial<ReglaFila> & { id: string }): Promise<string | null>
  activarRegla(id: string, base: boolean, activa: boolean): Promise<string | null>
  eliminarRegla(id: string): Promise<string | null>
  // ---- Fase 2: visitas y citas (eventos), tareas y tipos de cita ----
  /** Eventos que se ven entre dos días: los que caen dentro, las series que ya empezaron y sus excepciones */
  listarEventos(desde: string, hasta: string): Promise<Resultado<Evento[]>>
  /** Visitas pendientes desde hoy enlazadas a una orden (para «Próxima visita» y «Por programar») */
  listarVisitasFuturas(hoy: string): Promise<Resultado<Evento[]>>
  /** Citas no canceladas de unos tipos (para las reglas de plazo que cuentan desde una cita) */
  listarEventosDeTipos(tipos: string[]): Promise<Resultado<Evento[]>>
  /** Visitas, citas y tareas de una orden */
  listarAgendaOrden(ordenId: string): Promise<Resultado<{ eventos: Evento[]; tareas: Tarea[] }>>
  crearEvento(e: EventoInput): Promise<Resultado<Evento>>
  actualizarEvento(id: string, cambios: Partial<EventoInput>): Promise<Resultado<Evento>>
  eliminarEvento(id: string): Promise<string | null>
  /** Tareas con fecha entre dos días, más las pendientes sin fecha o atrasadas */
  listarTareas(desde: string, hasta: string): Promise<Resultado<Tarea[]>>
  crearTarea(t: TareaInput): Promise<Resultado<Tarea>>
  actualizarTarea(id: string, cambios: Partial<TareaInput>): Promise<Resultado<Tarea>>
  eliminarTarea(id: string): Promise<string | null>
  /** Cambios guardados de una orden (los escribe la base de datos; aquí solo se leen) */
  listarHistorial(ordenId: string): Promise<Resultado<CambioHistorial[]>>
  listarTipos(): Promise<Resultado<TipoCita[]>>
  guardarTipo(t: TipoCita): Promise<string | null>
}

export const MODO_DEMO = import.meta.env.DEV && import.meta.env.VITE_DEMO === '1'

let backend: Promise<Backend> | null = null

/** Carga el backend una sola vez (Supabase, o el de demo en desarrollo) */
export function api(): Promise<Backend> {
  if (!backend) {
    backend = MODO_DEMO ? import('./demo').then((m) => m.backendDemo) : import('./supabaseBackend').then((m) => m.backendSupabase)
  }
  return backend
}

/** Mensaje de error comprensible, sin detalles internos de la base de datos */
export function mensajeError(e: { message?: string; code?: string } | null | undefined): string {
  if (!e) return 'Error desconocido'
  if (e.code === '42501' || /row-level security|permission denied/i.test(e.message ?? '')) return 'No tienes permiso para esta acción. Vuelve a iniciar sesión.'
  if (e.code === '23505') return 'Ya existe un registro igual.'
  if (e.code === '23514') return 'Algún dato no es válido.'
  if (e.code === '23503') return 'Falta un dato relacionado (la orden o el tipo de cita ya no existe).'
  if (e.code === '42P01' || e.code === 'PGRST205') return 'Esta parte aún no está activada en la base de datos.'
  if (/fetch|network/i.test(e.message ?? '')) return 'Sin conexión. Inténtalo de nuevo.'
  return e.message ?? 'Error desconocido'
}
