// Datos INVENTADOS para las pruebas del servidor MCP (nunca datos reales).
// Un DatosMcp en memoria que apunta cada escritura, para comprobar qué se toca y qué no.
import type { Resultado } from '../data/backend'
import { CAMPOS_EVENTO, leerEvento, soloCampos, ultimoDia, type Evento } from '../lib/eventos'
import { CAMPOS_TAREA, leerTarea, type Tarea } from '../lib/tareas'
import { ORDEN_VACIA, type Orden } from '../lib/ordenes'
import { FESTIVOS_ALBACETE } from '../lib/festivosAlbacete'
import type { CambioHistorial } from '../lib/historial'
import type { DatosMcp } from './comun'

export interface Escritura {
  metodo: string
  id?: string
  campos: string[]
  datos: Record<string, unknown>
}

const ok = <T>(data: T): Resultado<T> => ({ data, error: null })
let n = 0
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`

export const ID = {
  o1: 'aaaaaaaa-0000-4000-8000-000000000001',
  o2: 'aaaaaaaa-0000-4000-8000-000000000002',
  o3: 'aaaaaaaa-0000-4000-8000-000000000003',
  v1: 'bbbbbbbb-0000-4000-8000-000000000001',
  v2: 'bbbbbbbb-0000-4000-8000-000000000002',
  serie: 'bbbbbbbb-0000-4000-8000-000000000003',
  t1: 'cccccccc-0000-4000-8000-000000000001',
  t2: 'cccccccc-0000-4000-8000-000000000002',
}

const orden = (p: Partial<Orden>): Orden => ({ ...ORDEN_VACIA, id: id(), created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...p }) as Orden

/** Hoy en las pruebas: viernes 20-11-2026 */
export function datosPrueba(opciones: { fallar?: boolean } = {}) {
  const escrituras: Escritura[] = []
  const ordenes: Orden[] = [
    orden({
      id: ID.o1,
      num_orden: 'PRUEBA/001',
      empresa: 'TALLERES INVENTADOS SL',
      fecha_orden: '2026-02-10',
      fecha_primera_actuacion: '2026-03-01', // 9 meses → 01-12-2026 (en 11 días)
      fecha_ultima_actuacion: '2026-05-10',
      estado_visita: 'SIN VISITA',
      objeto: 'OBJETO SECRETO DE PRUEBA',
      situacion_general: 'SITUACION SECRETA',
    }),
    orden({
      id: ID.o2,
      num_orden: 'PRUEBA/002',
      empresa: 'Bodegas Ficticias',
      estado: 'PTE ENTREGA',
      fecha_orden: '2025-12-01',
      fecha_primera_actuacion: '2026-01-15', // 9 meses → 15-10-2026 (vencido)
      fecha_ultima_actuacion: '2026-01-15',
    }),
    orden({ id: ID.o3, num_orden: 'PRUEBA/003', empresa: 'Cerrada SA', estado: 'FINALIZADA', fecha_orden: '2026-01-05', fecha_cierre: '2026-11-02' }),
  ]
  const ev = (p: Partial<Evento>): Evento => leerEvento({ estado: 'pendiente', tipo: 'visita', titulo: 'Visita', todo_el_dia: true, origen: 'app', ...p })!
  const eventos: Evento[] = [
    ev({ id: ID.v1, fecha: '2026-11-22', orden_id: ID.o1, ubicacion: 'CALLE INVENTADA 1', telefono: '600000000', notas: 'NOTA SECRETA', hora_inicio: '10:00', todo_el_dia: false }),
    ev({ id: ID.v2, fecha: '2026-11-23', orden_id: ID.o2, tipo: 'comparecencia', titulo: 'Comparecencia' }),
    ev({ id: ID.serie, fecha: '2026-11-02', rrule: 'FREQ=WEEKLY;COUNT=10', titulo: 'Ronda semanal' }),
    ev({ id: id(), fecha: '2026-03-08', orden_id: ID.o1, estado: 'hecha' }),
    ev({ id: id(), fecha: '2026-04-12', orden_id: ID.o2, estado: 'fallida' }),
  ]
  const tareas: Tarea[] = [
    leerTarea({ id: ID.t1, titulo: 'Llamar a la empresa', orden_id: ID.o1, vence: '2026-11-20', prioridad: 'alta', hecha: false, repeticion: 'no', oficina: false, notas: 'NOTA TAREA SECRETA' })!,
    leerTarea({ id: ID.t2, titulo: 'Subir documentación', vence: null, prioridad: 'media', hecha: false, repeticion: 'no', oficina: true })!,
  ]
  const historial: CambioHistorial[] = [
    { id: 1, orden_id: ID.o1, momento: '2026-02-10T08:00:00+00:00', tipo: 'alta', campo: null, antes: null, despues: 'EN CURSO' },
    // 23:30 UTC del 19-11 = 00:30 del 20-11 en España
    { id: 2, orden_id: ID.o1, momento: '2026-11-19T23:30:00+00:00', tipo: 'cambio', campo: 'situacion_general', antes: null, despues: 'SITUACION SECRETA' },
    { id: 3, orden_id: ID.o1, momento: '2026-11-19T23:31:00+00:00', tipo: 'cambio', campo: 'estado_docum', antes: 'AUN NADA', despues: 'SOLICITADA' },
  ]

  const apuntar = (metodo: string, datos: Record<string, unknown>, idObj?: string) => {
    escrituras.push({ metodo, id: idObj, campos: Object.keys(datos), datos })
  }
  const fallo = () => {
    // Simula un error interno con detalles que NO deben llegar a ChatGPT
    throw new Error('relation "public.secreta" does not exist at 10.0.0.1')
  }

  const datos: DatosMcp = {
    async listarOrdenes() {
      if (opciones.fallar) fallo()
      return ok(ordenes.map((o) => ({ ...o })))
    },
    async crearOrden(p) {
      apuntar('crearOrden', p as Record<string, unknown>)
      const o = orden(p)
      ordenes.push(o)
      return ok(o)
    },
    async actualizarOrden(oid, p) {
      apuntar('actualizarOrden', p as Record<string, unknown>, oid)
      const i = ordenes.findIndex((o) => o.id === oid)
      ordenes[i] = { ...ordenes[i], ...p }
      return ok({ ...ordenes[i] })
    },
    async listarFestivos(desde, hasta) {
      return ok(FESTIVOS_ALBACETE.filter((f) => f.fecha >= desde && f.fecha <= hasta))
    },
    async listarReglas() {
      return ok([])
    },
    async listarEventos(desde, hasta) {
      return ok(eventos.filter((e) => (e.fecha <= hasta && ultimoDia(e) >= desde) || (e.rrule && e.fecha <= hasta)))
    },
    async listarVisitasFuturas(hoy) {
      return ok(eventos.filter((e) => e.tipo === 'visita' && e.estado === 'pendiente' && e.fecha >= hoy && e.orden_id))
    },
    async listarEventosDeTipos(t) {
      return ok(eventos.filter((e) => t.includes(e.tipo)))
    },
    async listarAgendaOrden(oid) {
      return ok({ eventos: eventos.filter((e) => e.orden_id === oid), tareas: tareas.filter((t) => t.orden_id === oid) })
    },
    async obtenerEvento(eid) {
      return ok(eventos.find((e) => e.id === eid) ?? null)
    },
    async crearEvento(p) {
      apuntar('crearEvento', p as unknown as Record<string, unknown>)
      const e = leerEvento({ ...soloCampos(p, CAMPOS_EVENTO), id: id() })
      if (!e) return { data: null, error: 'Algún dato no es válido.' }
      eventos.push(e)
      return ok(e)
    },
    async actualizarEvento(eid, p) {
      apuntar('actualizarEvento', p as Record<string, unknown>, eid)
      const i = eventos.findIndex((e) => e.id === eid)
      const e = leerEvento({ ...eventos[i], ...soloCampos(p, CAMPOS_EVENTO) })!
      eventos[i] = e
      return ok(e)
    },
    async listarTareas(desde, hasta) {
      return ok(tareas.filter((t) => (t.vence && t.vence >= desde && t.vence <= hasta) || (!t.hecha && (!t.vence || t.vence < desde))))
    },
    async obtenerTarea(tid) {
      return ok(tareas.find((t) => t.id === tid) ?? null)
    },
    async crearTarea(p) {
      apuntar('crearTarea', p as unknown as Record<string, unknown>)
      const t = leerTarea({ ...soloCampos(p, CAMPOS_TAREA), id: id() })!
      tareas.push(t)
      return ok(t)
    },
    async actualizarTarea(tid, p) {
      apuntar('actualizarTarea', p as Record<string, unknown>, tid)
      const i = tareas.findIndex((t) => t.id === tid)
      tareas[i] = leerTarea({ ...tareas[i], ...soloCampos(p, CAMPOS_TAREA) })!
      return ok(tareas[i])
    },
    async listarHistorial(oid) {
      return ok(historial.filter((h) => h.orden_id === oid))
    },
    async listarTipos() {
      return ok([])
    },
  }
  return { datos, escrituras, ordenes, eventos, tareas }
}
