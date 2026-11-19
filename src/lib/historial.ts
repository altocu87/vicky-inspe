// Historial de una orden: todo lo que ha ido pasando, en orden cronológico y con los días.
// Junta (1) las fechas de la orden, (2) sus visitas y citas, (3) sus tareas y
// (4) los cambios guardados por la base de datos (tabla historial_ordenes, la escribe un disparador).
import { diasEntre, esIso, toIso } from './fechas'
import { NOMBRE_ESTADO_EVENTO, type Evento, type TipoCita } from './eventos'
import { label, type Orden } from './ordenes'
import type { Tarea } from './tareas'

export interface CambioHistorial {
  id: number
  orden_id: string
  /** Fecha y hora (ISO con zona) */
  momento: string
  tipo: 'alta' | 'cambio'
  campo: string | null
  antes: string | null
  despues: string | null
}

export type ClaseEntrada = 'hito' | 'visita' | 'tarea' | 'cambio'

export interface EntradaHistorial {
  clave: string
  fecha: string
  hora: string | null
  clase: ClaseEntrada
  icono: string
  titulo: string
  detalle: string | null
  /** Aún no ha pasado (visita programada, tarea pendiente) */
  futura: boolean
  /** Días desde la fecha de la orden (null si no hay fecha de la orden) */
  dia: number | null
  /** Días desde la entrada anterior */
  desdeAnterior: number | null
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const corto = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : null)

/** Valida una fila de historial_ordenes */
export function leerCambio(f: unknown): CambioHistorial | null {
  if (!f || typeof f !== 'object') return null
  const r = f as Record<string, unknown>
  if (!Number.isInteger(r.id) || typeof r.orden_id !== 'string' || !RE_UUID.test(r.orden_id)) return null
  if (typeof r.momento !== 'string' || Number.isNaN(Date.parse(r.momento))) return null
  if (r.tipo !== 'alta' && r.tipo !== 'cambio') return null
  const campo = typeof r.campo === 'string' && /^[a-z_]{1,40}$/.test(r.campo) ? r.campo : null
  return { id: r.id as number, orden_id: r.orden_id, momento: r.momento, tipo: r.tipo, campo, antes: corto(r.antes), despues: corto(r.despues) }
}

export const NOMBRE_CAMPO_HIST: Record<string, string> = {
  estado: 'Estado',
  num_orden: 'Nº de orden',
  empresa: 'Empresa',
  fecha_orden: 'Fecha de la orden',
  fecha_primera_actuacion: '1.ª actuación',
  fecha_ultima_actuacion: 'Última actuación',
  fecha_cierre: 'Fecha de cierre',
  objeto: 'Objeto',
  estado_docum: 'Documentación',
  estado_visita: 'Estado de la visita',
  fecha_visita: 'Notas de visita (Excel)',
  situacion_general: 'Situación general',
  tareas_pendientes: 'Tareas pendientes (texto)',
  comparecencia_subida: '¿Comparecencia subida?',
  doc_subida: '¿Documentación subida?',
  claves: 'Claves',
}

/** Valor legible: fechas en dd/mm/aaaa, estados con su nombre, vacío como «—» */
function valor(campo: string | null, v: string | null): string {
  if (v === null || v === '') return '—'
  if (campo?.startsWith('fecha_') && campo !== 'fecha_visita' && esIso(v)) return v.split('-').reverse().join('/')
  return label(v)
}

const ICONO_CAMPO: Record<string, string> = { estado: 'swap_horiz', estado_visita: 'directions_car', estado_docum: 'description' }

export function construirHistorial(
  o: Pick<Orden, 'id' | 'fecha_orden' | 'fecha_primera_actuacion' | 'fecha_ultima_actuacion' | 'fecha_cierre' | 'estado'>,
  eventos: readonly Evento[],
  tareas: readonly Tarea[],
  cambios: readonly CambioHistorial[],
  tipos: ReadonlyMap<string, TipoCita>,
  hoy: string,
): EntradaHistorial[] {
  const out: Omit<EntradaHistorial, 'dia' | 'desdeAnterior'>[] = []
  const hito = (clave: string, f: string | null, icono: string, titulo: string) => {
    if (esIso(f)) out.push({ clave, fecha: f, hora: null, clase: 'hito', icono, titulo, detalle: null, futura: f > hoy })
  }
  hito('h:orden', o.fecha_orden, 'inbox', 'Fecha de la orden')
  hito('h:primera', o.fecha_primera_actuacion, 'play_arrow', '1.ª actuación')
  if (o.fecha_ultima_actuacion !== o.fecha_primera_actuacion) hito('h:ultima', o.fecha_ultima_actuacion, 'update', 'Última actuación')
  if (o.estado === 'FINALIZADA') hito('h:cierre', o.fecha_cierre, 'task_alt', 'Orden cerrada')

  for (const e of eventos) {
    if (e.orden_id !== o.id || e.estado === 'cancelada' || e.rrule) continue
    const t = tipos.get(e.tipo)
    const estado = e.estado === 'pendiente' ? (e.fecha >= hoy ? 'programada' : 'sin marcar') : NOMBRE_ESTADO_EVENTO[e.estado].toLowerCase()
    out.push({
      clave: 'e:' + e.id,
      fecha: e.fecha,
      hora: e.todo_el_dia ? null : e.hora_inicio,
      clase: 'visita',
      icono: e.estado === 'hecha' ? 'check_circle' : e.estado === 'fallida' ? 'cancel' : (t?.icono ?? 'event'),
      titulo: `${e.titulo && !/^visita$/i.test(e.titulo) ? e.titulo : (t?.nombre ?? 'Cita')}: ${estado}`,
      detalle: e.notas,
      futura: e.fecha > hoy,
    })
  }
  for (const t of tareas) {
    if (t.orden_id !== o.id) continue
    if (t.hecha_el && (t.hecha || t.repeticion !== 'no')) {
      out.push({ clave: 't:' + t.id + ':h', fecha: t.hecha_el, hora: null, clase: 'tarea', icono: 'task_alt', titulo: `Tarea hecha: ${t.titulo}`, detalle: t.notas, futura: false })
    }
    if (!t.hecha && t.vence) {
      out.push({ clave: 't:' + t.id, fecha: t.vence, hora: t.hora, clase: 'tarea', icono: 'pending_actions', titulo: `Tarea pendiente: ${t.titulo}`, detalle: t.notas, futura: t.vence >= hoy })
    }
  }
  for (const c of cambios) {
    if (c.orden_id !== o.id) continue
    const d = new Date(c.momento)
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    if (c.tipo === 'alta') {
      out.push({ clave: 'c:' + c.id, fecha: toIso(d), hora, clase: 'cambio', icono: 'add_circle', titulo: 'Orden dada de alta en la app', detalle: c.despues ? `Estado: ${label(c.despues)}` : null, futura: false })
      continue
    }
    const nombre = NOMBRE_CAMPO_HIST[c.campo ?? ''] ?? c.campo ?? 'Dato'
    out.push({
      clave: 'c:' + c.id,
      fecha: toIso(d),
      hora,
      clase: 'cambio',
      icono: ICONO_CAMPO[c.campo ?? ''] ?? 'edit',
      titulo: `${nombre}: ${valor(c.campo, c.antes)} → ${valor(c.campo, c.despues)}`,
      detalle: null,
      futura: false,
    })
  }

  const PESO: Record<ClaseEntrada, number> = { hito: 0, visita: 1, tarea: 2, cambio: 3 }
  out.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? '') || PESO[a.clase] - PESO[b.clase])
  const base = esIso(o.fecha_orden) ? o.fecha_orden : null
  return out.map((e, i) => ({
    ...e,
    dia: base ? diasEntre(base, e.fecha) : null,
    desdeAnterior: i > 0 ? diasEntre(out[i - 1].fecha, e.fecha) : null,
  }))
}
