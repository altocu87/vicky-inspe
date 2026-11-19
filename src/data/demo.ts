// Backend de DEMOSTRACIÓN, en memoria, con datos inventados. Solo se carga en desarrollo
// con VITE_DEMO=1 (ver api.ts). Sirve para probar y hacer capturas sin datos reales.
import type { Session } from '@supabase/supabase-js'
import { addDias, edate, hoyIso } from '../lib/fechas'
import { FESTIVOS_ALBACETE } from '../lib/festivosAlbacete'
import type { Festivo } from '../lib/habiles'
import { ESTADOS_DOCUM, type Estado, type Orden } from '../lib/ordenes'
import type { ReglaFila } from '../lib/plazos/reglas'
import { leerEvento, soloCampos, CAMPOS_EVENTO, TIPOS_BASE, eventoNuevo, ultimoDia, type Evento, type TipoCita } from '../lib/eventos'
import { leerTarea, tareaNueva, CAMPOS_TAREA, type Tarea } from '../lib/tareas'
import { proximoLunes } from '../lib/semana'
import type { Backend } from './api'

const EMPRESAS = [
  'TALLERES PÉREZ SL',
  'CONSTRUCCIONES LA MANCHA SA',
  'BODEGAS EJEMPLO SL',
  'TRANSPORTES DEMO SL',
  'CAFETERÍA EL PRUEBA',
  'METALÚRGICA FICTICIA SA',
  'LIMPIEZAS INVENTADAS SL',
  'PANADERÍA DE MUESTRA',
  'AGRÍCOLA DEL LLANO SL',
  'HOSTAL IMAGINARIO',
  'CARPINTERÍA PRUEBAS SL',
  'ELECTRICIDAD DEMO SL',
  'RESIDENCIA EJEMPLAR',
  'FRUTAS TEST SL',
  'MUEBLES MODELO SA',
  'GESTORÍA SIMULADA SL',
  'AUTOESCUELA PRUEBA',
  'CLÍNICA DEMO SL',
  'HIERROS FICTICIOS SL',
  'IMPRENTA DE EJEMPLO',
  'COOPERATIVA MUESTRA',
  'TEXTIL INVENTADO SA',
  'BAR LA PRUEBA',
  'OBRAS Y REFORMAS DEMO',
  'QUESOS DE EJEMPLO SL',
]

function generar(): Orden[] {
  const hoy = hoyIso()
  return EMPRESAS.map((empresa, i) => {
    // Plazos repartidos: vencidos, esta semana, próximas semanas y meses
    const primera = addDias(edate(hoy, -9), 40 - i * 9)
    const ultima = i % 3 === 0 ? null : addDias(edate(hoy, -5), 25 - i * 4)
    const estado: Estado = i === 24 ? 'FINALIZADA' : i % 5 === 4 ? 'PTE ENTREGA' : 'EN CURSO'
    return {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      num_orden: `2/00${String(4800 + i * 7).padStart(5, '0')}/26`,
      estado,
      empresa,
      fecha_orden: addDias(primera, -20),
      fecha_primera_actuacion: primera,
      fecha_ultima_actuacion: ultima,
      fecha_cierre: estado === 'FINALIZADA' ? hoy : null,
      objeto: i % 2 ? 'APORTA TODO LO SOLICITADO' : null,
      estado_docum: ESTADOS_DOCUM[i % 4],
      estado_visita: i % 4 === 0 ? 'REALIZADA' : 'SIN VISITA',
      fecha_visita: i % 4 === 0 ? '14/04/2026' : 'NO VISITA',
      situacion_general: null,
      tareas_pendientes: i % 6 === 0 ? 'Pedir contratos de trabajo' : null,
      comparecencia_subida: i % 2 ? 'SI' : null,
      doc_subida: null,
      claves: i % 3 ? 'SI' : null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
  })
}

let ordenes = generar()

/** Próximo día de la semana dow (0 = domingo) desde hoy, más n semanas */
function proximo(dow: number, semanas = 0): string {
  let d = hoyIso()
  while (new Date(d + 'T12:00').getDay() !== dow) d = addDias(d, 1)
  return addDias(d, semanas * 7)
}
const nuevoId = () => crypto.randomUUID()
const CALLES = ['C/ Mayor 12, Albacete', 'Avda. de España 30, Albacete', 'Pol. Ind. Campollano, Calle B 5, Albacete', 'C/ Tinte 4, Albacete', 'Paseo de la Libertad 8, Albacete']

function generarEventos(): Evento[] {
  const hoy = hoyIso()
  const ev = (p: Partial<Evento> & { fecha: string; titulo: string }): Evento => ({ ...eventoNuevo(p), ...p, id: nuevoId() }) as Evento
  const out: Evento[] = [
    // Visitas en domingo y lunes, enlazadas a órdenes
    ev({ titulo: 'Visita', fecha: proximo(0), todo_el_dia: false, hora_inicio: '10:00', hora_fin: '11:00', orden_id: ordenes[1].id, ubicacion: CALLES[0], telefono: '600 000 001' }),
    ev({ titulo: 'Visita', fecha: proximo(0), todo_el_dia: false, hora_inicio: '12:00', hora_fin: '13:00', orden_id: ordenes[4].id, ubicacion: CALLES[1] }),
    ev({ titulo: 'Visita', fecha: proximo(1), todo_el_dia: false, hora_inicio: '09:30', hora_fin: '10:30', orden_id: ordenes[7].id, ubicacion: CALLES[2], telefono: '967 000 002' }),
    ev({ titulo: 'Visita', fecha: proximo(0, 1), todo_el_dia: false, hora_inicio: '10:00', orden_id: ordenes[10].id, ubicacion: CALLES[3] }),
    ev({ titulo: 'Comparecencia', tipo: 'comparecencia', fecha: proximo(3), todo_el_dia: false, hora_inicio: '11:00', hora_fin: '11:30', orden_id: ordenes[2].id, ubicacion: 'Oficina' }),
    ev({ titulo: 'Visita', fecha: addDias(hoy, -10), estado: 'hecha', orden_id: ordenes[3].id }),
    ev({ titulo: 'Visita', fecha: addDias(hoy, -4), estado: 'fallida', orden_id: ordenes[5].id, ubicacion: CALLES[4] }),
    ev({ titulo: 'Visita (Excel)', fecha: addDias(hoy, -40), estado: 'hecha', orden_id: ordenes[0].id, origen: 'excel', clave_origen: `excel:${ordenes[0].id}:${addDias(hoy, -40)}` }),
    ev({ titulo: 'Curso de formación', tipo: 'comparecencia', fecha: proximo(3, 1), fecha_fin: proximo(5, 1), todo_el_dia: true }),
  ]
  // Hoy también hay algo, para la vista «Hoy»
  out.push(ev({ titulo: 'Visita', fecha: hoy, todo_el_dia: false, hora_inicio: '17:00', hora_fin: '18:00', orden_id: ordenes[12].id, ubicacion: CALLES[0], telefono: '600 000 003' }))
  // Una serie: reunión de equipo cada lunes
  out.push(ev({ titulo: 'Reunión de equipo', tipo: 'comparecencia', fecha: proximo(1, -2), todo_el_dia: false, hora_inicio: '13:00', hora_fin: '14:00', rrule: 'FREQ=WEEKLY' }))
  return out.map((e) => leerEvento(e)!).filter(Boolean)
}

function generarTareas(): Tarea[] {
  const hoy = hoyIso()
  const t = (p: Partial<Tarea>): Tarea => leerTarea({ ...tareaNueva({ titulo: 'Tarea', ...p }), id: nuevoId() })!
  return [
    t({ titulo: 'Pedir contratos de trabajo', orden_id: ordenes[0].id, vence: hoy, prioridad: 'alta' }),
    t({ titulo: 'Redactar informe', orden_id: ordenes[3].id, vence: addDias(hoy, 2) }),
    t({ titulo: 'Subir comparecencia', orden_id: ordenes[1].id, oficina: true }),
    t({ titulo: 'Revisar correo del jefe', oficina: true, vence: proximoLunes(hoy), repeticion: 'semanal' }),
    t({ titulo: 'Llamar a la gestoría', prioridad: 'alta' }),
    t({ titulo: 'Ordenar el archivo', prioridad: 'baja' }),
    t({ titulo: 'Preparar requerimiento', orden_id: ordenes[6].id, vence: addDias(hoy, -2), prioridad: 'alta' }),
  ]
}

let eventos = generarEventos()
let tareas = generarTareas()
let tipos: TipoCita[] = [...TIPOS_BASE]
let festivos: Festivo[] = [...FESTIVOS_ALBACETE]
let reglas: ReglaFila[] = []
const espera = () => new Promise((r) => setTimeout(r, 120))
const sesionDemo = { user: { email: 'demo@ejemplo.test', id: 'demo' } } as unknown as Session

export const backendDemo: Backend = {
  async sesion() {
    return sesionDemo
  },
  alCambiarSesion() {
    return () => {}
  },
  async entrar() {
    return null
  },
  async salir() {},
  async listarOrdenes() {
    await espera()
    return { data: [...ordenes], error: null }
  },
  async crearOrden(p) {
    const o = { ...(p as Orden), id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ordenes = [o, ...ordenes]
    return { data: o, error: null }
  },
  async actualizarOrden(id, p) {
    const o = { ...ordenes.find((x) => x.id === id)!, ...p, updated_at: new Date().toISOString() } as Orden
    ordenes = ordenes.map((x) => (x.id === id ? o : x))
    return { data: o, error: null }
  },
  async eliminarOrden(id) {
    ordenes = ordenes.filter((x) => x.id !== id)
    // Como en la base de datos (on delete cascade)
    eventos = eventos.filter((x) => x.orden_id !== id)
    tareas = tareas.filter((x) => x.orden_id !== id)
    return null
  },
  async listarFestivos(desde, hasta) {
    return { data: festivos.filter((f) => f.fecha >= desde && f.fecha <= hasta), error: null }
  },
  async guardarFestivo(f) {
    festivos = [...festivos.filter((x) => x.fecha !== f.fecha), f].sort((a, b) => a.fecha.localeCompare(b.fecha))
    return null
  },
  async eliminarFestivo(fecha) {
    festivos = festivos.filter((x) => x.fecha !== fecha)
    return null
  },
  async listarReglas() {
    return { data: [...reglas], error: null }
  },
  async guardarRegla(r) {
    const prev = reglas.find((x) => x.id === r.id)
    const fila = {
      base: false,
      activa: true,
      nombre: null,
      corto: null,
      partida: null,
      unidad: null,
      cantidad: null,
      tope: null,
      estados: null,
      avisos: null,
      ...prev,
      ...r,
    }
    reglas = [...reglas.filter((x) => x.id !== r.id), fila]
    return null
  },
  async activarRegla(id, base, activa) {
    return this.guardarRegla({ id, base, activa })
  },
  async eliminarRegla(id) {
    reglas = reglas.filter((x) => x.id !== id || x.base)
    return null
  },

  async listarEventos(desde, hasta) {
    await espera()
    return {
      data: eventos.filter(
        (e) =>
          (e.fecha <= hasta && ultimoDia(e) >= desde) ||
          (e.rrule && e.fecha <= hasta) ||
          (e.ocurrencia_original && e.ocurrencia_original >= desde && e.ocurrencia_original <= hasta),
      ),
      error: null,
    }
  },
  async listarVisitasFuturas(hoy) {
    return { data: eventos.filter((e) => e.tipo === 'visita' && e.estado === 'pendiente' && e.fecha >= hoy && e.orden_id), error: null }
  },
  async listarAgendaOrden(id) {
    return { data: { eventos: eventos.filter((e) => e.orden_id === id), tareas: tareas.filter((t) => t.orden_id === id) }, error: null }
  },
  async crearEvento(p) {
    const e = leerEvento({ ...soloCampos(p, CAMPOS_EVENTO), id: nuevoId() })
    if (!e) return { data: null, error: 'Algún dato no es válido.' }
    eventos = [...eventos, e]
    return { data: e, error: null }
  },
  async actualizarEvento(id, p) {
    const prev = eventos.find((x) => x.id === id)
    const e = prev && leerEvento({ ...prev, ...soloCampos(p, CAMPOS_EVENTO) })
    if (!e) return { data: null, error: 'Algún dato no es válido.' }
    eventos = eventos.map((x) => (x.id === id ? e : x))
    return { data: e, error: null }
  },
  async eliminarEvento(id) {
    eventos = eventos.filter((x) => x.id !== id && x.serie_id !== id)
    return null
  },
  async listarTareas(desde, hasta) {
    return { data: tareas.filter((t) => (t.vence && t.vence >= desde && t.vence <= hasta) || (!t.hecha && (!t.vence || t.vence < desde))), error: null }
  },
  async crearTarea(p) {
    const t = leerTarea({ ...soloCampos(p, CAMPOS_TAREA), id: nuevoId() })
    if (!t) return { data: null, error: 'Algún dato no es válido.' }
    tareas = [...tareas, t]
    return { data: t, error: null }
  },
  async actualizarTarea(id, p) {
    const prev = tareas.find((x) => x.id === id)
    const t = prev && leerTarea({ ...prev, ...soloCampos(p, CAMPOS_TAREA) })
    if (!t) return { data: null, error: 'Algún dato no es válido.' }
    tareas = tareas.map((x) => (x.id === id ? t : x))
    return { data: t, error: null }
  },
  async eliminarTarea(id) {
    tareas = tareas.filter((x) => x.id !== id)
    return null
  },
  async listarTipos() {
    return { data: [...tipos], error: null }
  },
  async guardarTipo(t) {
    tipos = [...tipos.filter((x) => x.id !== t.id), t]
    return null
  },
}
