// Acceso real a Supabase. Solo lo usa api.ts.
import { supabase } from '../lib/supabase'
import type { Orden } from '../lib/ordenes'
import type { Festivo } from '../lib/habiles'
import type { ReglaFila } from '../lib/plazos/reglas'
import { CAMPOS_EVENTO, leerEvento, leerTipo, soloCampos, type Evento, type TipoCita } from '../lib/eventos'
import { CAMPOS_TAREA, leerTarea, type Tarea } from '../lib/tareas'
import { addDias, esIso } from '../lib/fechas'
import { mensajeError, type Backend, type Resultado } from './api'

const ok = <T>(data: T): Resultado<T> => ({ data, error: null })
const ko = <T>(e: { message?: string; code?: string }): Resultado<T> => ({ data: null, error: mensajeError(e) })

// Columnas pedidas explícitamente (no se baja nada que no se use)
const COLS_FESTIVO = 'fecha,nombre,ambito,fuente'
const COLS_REGLA = 'id,base,activa,nombre,corto,partida,unidad,cantidad,tope,estados,avisos'
const COLS_EVENTO =
  'id,titulo,tipo,fecha,fecha_fin,todo_el_dia,hora_inicio,hora_fin,ubicacion,telefono,notas,orden_id,estado,avisos,rrule,exdates,serie_id,ocurrencia_original,origen,clave_origen,created_at,updated_at'
const COLS_TAREA = 'id,titulo,notas,orden_id,vence,hora,duracion_min,prioridad,hecha,hecha_el,repeticion,oficina,created_at,updated_at'
const COLS_TIPO = 'id,nombre,icono,orden,activo'

// Todo lo que llega se valida (leerEvento, leerTarea…): una fila rara se descarta, nunca se usa tal cual
const eventos = (d: unknown[] | null): Evento[] => (d ?? []).map(leerEvento).filter((e): e is Evento => !!e)
const tareas = (d: unknown[] | null): Tarea[] => (d ?? []).map(leerTarea).filter((t): t is Tarea => !!t)
const unEvento = (d: unknown): Resultado<Evento> => {
  const e = leerEvento(d)
  return e ? ok(e) : { data: null, error: 'Respuesta no válida' }
}
const unaTarea = (d: unknown): Resultado<Tarea> => {
  const t = leerTarea(d)
  return t ? ok(t) : { data: null, error: 'Respuesta no válida' }
}
/** Solo fechas válidas en los filtros (se construyen como texto) */
function fechas(...f: string[]) {
  if (!f.every(esIso)) throw new Error('Fecha no válida')
}

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

  // ---------- Fase 2 ----------
  async listarEventos(desde, hasta) {
    fechas(desde, hasta)
    // Dentro del rango; o empezó antes y aún dura; o es una serie ya empezada; o es una excepción de un día del rango
    const desdeLargo = addDias(desde, -366)
    const { data, error } = await supabase
      .from('eventos')
      .select(COLS_EVENTO)
      .or(
        `and(fecha.gte.${desde},fecha.lte.${hasta}),` +
          `and(fecha.gte.${desdeLargo},fecha.lt.${desde},fecha_fin.gte.${desde}),` +
          `and(rrule.not.is.null,fecha.lte.${hasta}),` +
          `and(serie_id.not.is.null,ocurrencia_original.gte.${desde},ocurrencia_original.lte.${hasta})`,
      )
      .limit(5000)
    return error ? ko(error) : ok(eventos(data))
  },
  async listarVisitasFuturas(hoy) {
    fechas(hoy)
    const { data, error } = await supabase
      .from('eventos')
      .select(COLS_EVENTO)
      .eq('tipo', 'visita')
      .eq('estado', 'pendiente')
      .gte('fecha', hoy)
      .not('orden_id', 'is', null)
      .order('fecha')
      .limit(5000)
    return error ? ko(error) : ok(eventos(data))
  },
  async listarEventosDeTipos(tipos) {
    const validos = tipos.filter((t) => /^[a-z0-9_]{2,40}$/.test(t))
    if (!validos.length) return ok([])
    const { data, error } = await supabase
      .from('eventos')
      .select(COLS_EVENTO)
      .in('tipo', validos)
      .neq('estado', 'cancelada')
      .not('orden_id', 'is', null)
      .limit(10000)
    return error ? ko(error) : ok(eventos(data))
  },
  async listarAgendaOrden(ordenId) {
    const [e, t] = await Promise.all([
      supabase.from('eventos').select(COLS_EVENTO).eq('orden_id', ordenId).order('fecha').limit(1000),
      supabase.from('tareas').select(COLS_TAREA).eq('orden_id', ordenId).order('vence').limit(1000),
    ])
    if (e.error) return ko(e.error)
    if (t.error) return ko(t.error)
    return ok({ eventos: eventos(e.data), tareas: tareas(t.data) })
  },
  async crearEvento(ev) {
    const { data, error } = await supabase.from('eventos').insert(soloCampos(ev, CAMPOS_EVENTO)).select(COLS_EVENTO).single()
    return error ? ko(error) : unEvento(data)
  },
  async actualizarEvento(id, cambios) {
    const { data, error } = await supabase.from('eventos').update(soloCampos(cambios, CAMPOS_EVENTO)).eq('id', id).select(COLS_EVENTO).single()
    return error ? ko(error) : unEvento(data)
  },
  async eliminarEvento(id) {
    const { error } = await supabase.from('eventos').delete().eq('id', id)
    return error ? mensajeError(error) : null
  },
  async listarTareas(desde, hasta) {
    fechas(desde, hasta)
    const { data, error } = await supabase
      .from('tareas')
      .select(COLS_TAREA)
      .or(`and(vence.gte.${desde},vence.lte.${hasta}),and(hecha.eq.false,vence.is.null),and(hecha.eq.false,vence.lt.${desde})`)
      .limit(5000)
    return error ? ko(error) : ok(tareas(data))
  },
  async crearTarea(t) {
    const { data, error } = await supabase.from('tareas').insert(soloCampos(t, CAMPOS_TAREA)).select(COLS_TAREA).single()
    return error ? ko(error) : unaTarea(data)
  },
  async actualizarTarea(id, cambios) {
    const { data, error } = await supabase.from('tareas').update(soloCampos(cambios, CAMPOS_TAREA)).eq('id', id).select(COLS_TAREA).single()
    return error ? ko(error) : unaTarea(data)
  },
  async eliminarTarea(id) {
    const { error } = await supabase.from('tareas').delete().eq('id', id)
    return error ? mensajeError(error) : null
  },
  async listarTipos() {
    const { data, error } = await supabase.from('tipos_cita').select(COLS_TIPO).order('orden')
    return error ? ko(error) : ok((data ?? []).map(leerTipo).filter((t): t is TipoCita => !!t))
  },
  async guardarTipo(t) {
    const { error } = await supabase.from('tipos_cita').upsert({ id: t.id, nombre: t.nombre, icono: t.icono, orden: t.orden, activo: t.activo }, { onConflict: 'id' })
    return error ? mensajeError(error) : null
  },
}
