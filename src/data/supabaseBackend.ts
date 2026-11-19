// Acceso real a Supabase. Solo lo usa api.ts.
import { supabase } from '../lib/supabase'
import type { Orden } from '../lib/ordenes'
import type { Festivo } from '../lib/habiles'
import type { ReglaFila } from '../lib/plazos/reglas'
import { mensajeError, type Backend, type Resultado } from './api'

const ok = <T>(data: T): Resultado<T> => ({ data, error: null })
const ko = <T>(e: { message?: string; code?: string }): Resultado<T> => ({ data: null, error: mensajeError(e) })

// Columnas pedidas explícitamente (no se baja nada que no se use)
const COLS_FESTIVO = 'fecha,nombre,ambito,fuente'
const COLS_REGLA = 'id,base,activa,nombre,corto,partida,unidad,cantidad,tope,estados,avisos'

export const backendSupabase: Backend = {
  async sesion() {
    const { data } = await supabase.auth.getSession()
    return data.session
  },
  alCambiarSesion(fn) {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => fn(s))
    return () => data.subscription.unsubscribe()
  },
  async entrar(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? 'Correo o contraseña incorrectos' : null
  },
  async salir() {
    await supabase.auth.signOut()
  },

  async listarOrdenes() {
    const { data, error } = await supabase.from('ordenes').select('*').order('fecha_orden', { ascending: false })
    return error ? ko(error) : ok(data as Orden[])
  },
  async crearOrden(payload) {
    const { data, error } = await supabase.from('ordenes').insert(payload).select().single()
    return error ? ko(error) : ok(data as Orden)
  },
  async actualizarOrden(id, payload) {
    const { data, error } = await supabase.from('ordenes').update(payload).eq('id', id).select().single()
    return error ? ko(error) : ok(data as Orden)
  },
  async eliminarOrden(id) {
    const { error } = await supabase.from('ordenes').delete().eq('id', id)
    return error ? mensajeError(error) : null
  },

  async listarFestivos(desde, hasta) {
    const { data, error } = await supabase.from('festivos').select(COLS_FESTIVO).gte('fecha', desde).lte('fecha', hasta).order('fecha')
    return error ? ko(error) : ok(data as Festivo[])
  },
  async guardarFestivo(f) {
    const { error } = await supabase
      .from('festivos')
      .upsert({ fecha: f.fecha, nombre: f.nombre, ambito: f.ambito, fuente: f.fuente ?? null }, { onConflict: 'fecha' })
    return error ? mensajeError(error) : null
  },
  async eliminarFestivo(fecha) {
    const { error } = await supabase.from('festivos').delete().eq('fecha', fecha)
    return error ? mensajeError(error) : null
  },

  async listarReglas() {
    const { data, error } = await supabase.from('reglas_plazo').select(COLS_REGLA)
    return error ? ko(error) : ok(data as ReglaFila[])
  },
  async guardarRegla(r) {
    const { error } = await supabase.from('reglas_plazo').upsert(r, { onConflict: 'id' })
    return error ? mensajeError(error) : null
  },
  async activarRegla(id, base, activa) {
    // Regla base: puede que aún no tenga fila → insertar o actualizar. Personalizada: solo actualizar.
    const { error } = base
      ? await supabase.from('reglas_plazo').upsert({ id, base: true, activa }, { onConflict: 'id' })
      : await supabase.from('reglas_plazo').update({ activa }).eq('id', id).eq('base', false)
    return error ? mensajeError(error) : null
  },
  async eliminarRegla(id) {
    const { error } = await supabase.from('reglas_plazo').delete().eq('id', id).eq('base', false)
    return error ? mensajeError(error) : null
  },
}
