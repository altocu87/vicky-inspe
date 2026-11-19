// Visitas y citas (tabla `eventos`) y tipos de cita (tabla `tipos_cita`).
// Todo lo que llega de la base de datos se valida aquí antes de usarse: una fila rara se descarta.
import { addDias, esIso } from './fechas'

export const ESTADOS_EVENTO = ['pendiente', 'hecha', 'fallida', 'cancelada'] as const
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number]
export const NOMBRE_ESTADO_EVENTO: Record<EstadoEvento, string> = {
  pendiente: 'Pendiente',
  hecha: 'Hecha',
  fallida: 'Fallida',
  cancelada: 'Cancelada',
}

export type Origen = 'app' | 'excel'

export interface Evento {
  id: string
  titulo: string
  tipo: string
  /** Día de inicio 'aaaa-mm-dd' */
  fecha: string
  /** Último día (INCLUSIVO) si dura varios días; null = un solo día */
  fecha_fin: string | null
  todo_el_dia: boolean
  /** 'HH:MM' (hora local de España) o null si es de todo el día */
  hora_inicio: string | null
  hora_fin: string | null
  ubicacion: string | null
  telefono: string | null
  notas: string | null
  orden_id: string | null
  estado: EstadoEvento
  /** Minutos antes del inicio en que se avisa */
  avisos: number[]
  /** Regla de repetición SIN DTSTART (la fecha de inicio es `fecha`) */
  rrule: string | null
  /** Días quitados de la serie */
  exdates: string[]
  /** Excepción «solo este»: id de la serie y día original que sustituye */
  serie_id: string | null
  ocurrencia_original: string | null
  origen: Origen
  clave_origen: string | null
  created_at?: string
  updated_at?: string
}

export type EventoInput = Omit<Evento, 'id' | 'created_at' | 'updated_at'>

export interface TipoCita {
  id: string
  nombre: string
  icono: string
  orden: number
  activo: boolean
}

/** Los dos tipos del Excel; se pueden añadir más en Ajustes */
export const TIPOS_BASE: readonly TipoCita[] = [
  { id: 'visita', nombre: 'Visita', icono: 'directions_car', orden: 0, activo: true },
  { id: 'comparecencia', nombre: 'Comparecencia', icono: 'gavel', orden: 1, activo: true },
]

/** Iconos que se pueden elegir para un tipo de cita (lista cerrada) */
export const ICONOS_TIPO = ['directions_car', 'gavel', 'event', 'call', 'groups', 'mail', 'description', 'warning', 'work', 'home_work'] as const

export const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const RE_ID_TIPO = /^[a-z0-9_]{2,40}$/
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/
const RE_TEL = /^\+?[0-9 ]{3,20}$/
/** Repetición permitida: solo las partes que usa la app (nunca DTSTART) */
const RE_RRULE = /^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;(INTERVAL=\d{1,3}|COUNT=\d{1,3}|UNTIL=\d{8}(T\d{6}Z)?|BYDAY=((MO|TU|WE|TH|FR|SA|SU),){0,6}(MO|TU|WE|TH|FR|SA|SU)|BYMONTHDAY=-?\d{1,2}))*$/

export function rruleValida(s: unknown): s is string {
  return typeof s === 'string' && s.length <= 200 && RE_RRULE.test(s)
}

export function telefonoValido(s: string): boolean {
  return RE_TEL.test(s.trim())
}

const texto = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const hora = (v: unknown): string | null => (typeof v === 'string' && RE_HORA.test(v) ? v.slice(0, 5) : null)

/** Valida una fila de `eventos`. Devuelve null si no es válida. */
export function leerEvento(f: unknown): Evento | null {
  if (!f || typeof f !== 'object') return null
  const r = f as Record<string, unknown>
  if (typeof r.id !== 'string' || !RE_UUID.test(r.id)) return null
  const titulo = texto(r.titulo, 200)
  if (!titulo || typeof r.tipo !== 'string' || !RE_ID_TIPO.test(r.tipo) || !esIso(r.fecha)) return null
  const estado = (ESTADOS_EVENTO as readonly string[]).includes(r.estado as string) ? (r.estado as EstadoEvento) : 'pendiente'
  const hi = hora(r.hora_inicio)
  const todo = r.todo_el_dia === true || !hi
  const fin = esIso(r.fecha_fin) && r.fecha_fin >= r.fecha && todo ? r.fecha_fin : null
  const tel = texto(r.telefono, 20)
  const serie = typeof r.serie_id === 'string' && RE_UUID.test(r.serie_id) ? r.serie_id : null
  return {
    id: r.id,
    titulo,
    tipo: r.tipo,
    fecha: r.fecha,
    fecha_fin: fin === r.fecha ? null : fin,
    todo_el_dia: todo,
    hora_inicio: todo ? null : hi,
    hora_fin: todo ? null : (() => {
      const hf = hora(r.hora_fin)
      return hf && hi && hf > hi ? hf : null
    })(),
    ubicacion: texto(r.ubicacion, 300),
    telefono: tel && RE_TEL.test(tel) ? tel : null,
    notas: texto(r.notas, 4000),
    orden_id: typeof r.orden_id === 'string' && RE_UUID.test(r.orden_id) ? r.orden_id.toLowerCase() : null,
    estado,
    avisos: Array.isArray(r.avisos) ? r.avisos.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 525600).slice(0, 10) : [],
    rrule: !serie && rruleValida(r.rrule) ? r.rrule : null,
    exdates: Array.isArray(r.exdates) ? r.exdates.filter(esIso).slice(0, 500) : [],
    serie_id: serie,
    ocurrencia_original: serie && esIso(r.ocurrencia_original) ? r.ocurrencia_original : null,
    origen: r.origen === 'excel' ? 'excel' : 'app',
    clave_origen: texto(r.clave_origen, 100),
    created_at: typeof r.created_at === 'string' ? r.created_at : undefined,
    updated_at: typeof r.updated_at === 'string' ? r.updated_at : undefined,
  }
}

export function leerTipo(f: unknown): TipoCita | null {
  if (!f || typeof f !== 'object') return null
  const r = f as Record<string, unknown>
  if (typeof r.id !== 'string' || !RE_ID_TIPO.test(r.id)) return null
  const nombre = texto(r.nombre, 40)
  if (!nombre) return null
  return {
    id: r.id,
    nombre,
    icono: (ICONOS_TIPO as readonly string[]).includes(r.icono as string) ? (r.icono as string) : 'event',
    orden: Number.isInteger(r.orden) ? (r.orden as number) : 99,
    activo: r.activo !== false,
  }
}

/** Junta los tipos base con los guardados (los guardados mandan) y los ordena */
export function combinarTipos(filas: readonly TipoCita[]): TipoCita[] {
  const m = new Map(TIPOS_BASE.map((t) => [t.id, t]))
  for (const t of filas) m.set(t.id, t)
  return [...m.values()].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Último día que ocupa el evento (inclusivo) */
export function ultimoDia(e: Pick<Evento, 'fecha' | 'fecha_fin'>): string {
  return e.fecha_fin && e.fecha_fin > e.fecha ? e.fecha_fin : e.fecha
}

/** ¿Ocupa el día `iso`? */
export function ocupaDia(e: Pick<Evento, 'fecha' | 'fecha_fin'>, iso: string): boolean {
  return e.fecha <= iso && iso <= ultimoDia(e)
}

/** «10:00–11:30», «10:00» o «Todo el día» */
export function textoHora(e: Pick<Evento, 'todo_el_dia' | 'hora_inicio' | 'hora_fin'>): string {
  if (e.todo_el_dia || !e.hora_inicio) return 'Todo el día'
  return e.hora_fin ? `${e.hora_inicio}–${e.hora_fin}` : e.hora_inicio
}

/** Clave para ordenar dentro de un día: primero los de todo el día, luego por hora */
export function claveOrden(e: Pick<Evento, 'todo_el_dia' | 'hora_inicio' | 'titulo'>): string {
  return (e.todo_el_dia || !e.hora_inicio ? '00' : '1' + e.hora_inicio) + e.titulo
}

/** Duplica un evento (sin repetición ni excepción) para el mismo día o para otro */
export function duplicar(e: Evento, fecha: string = e.fecha): EventoInput {
  const desplaz = e.fecha_fin ? (Date.parse(e.fecha_fin) - Date.parse(e.fecha)) / 86_400_000 : 0
  return {
    titulo: e.titulo,
    tipo: e.tipo,
    fecha,
    fecha_fin: e.fecha_fin ? addDias(fecha, Math.round(desplaz)) : null,
    todo_el_dia: e.todo_el_dia,
    hora_inicio: e.hora_inicio,
    hora_fin: e.hora_fin,
    ubicacion: e.ubicacion,
    telefono: e.telefono,
    notas: e.notas,
    orden_id: e.orden_id,
    estado: 'pendiente',
    avisos: [...e.avisos],
    rrule: null,
    exdates: [],
    serie_id: null,
    ocurrencia_original: null,
    origen: 'app',
    clave_origen: null,
  }
}

export function eventoNuevo(p: Partial<EventoInput> & { fecha: string }): EventoInput {
  return {
    titulo: '',
    tipo: 'visita',
    fecha_fin: null,
    todo_el_dia: true,
    hora_inicio: null,
    hora_fin: null,
    ubicacion: null,
    telefono: null,
    notas: null,
    orden_id: null,
    estado: 'pendiente',
    avisos: [],
    rrule: null,
    exdates: [],
    serie_id: null,
    ocurrencia_original: null,
    origen: 'app',
    clave_origen: null,
    ...p,
  }
}

// ---------- Enlaces externos («Cómo llegar», «Llamar») ----------
// Se construyen codificando los datos y solo con esquemas permitidos.

/** Enlace a Google Maps (en el móvil abre la app de mapas) o null si no hay dirección */
export function enlaceMapa(ubicacion: string | null | undefined): string | null {
  const u = ubicacion?.trim()
  if (!u) return null
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(u.slice(0, 300))
}

/** Enlace tel: (solo dígitos y +) o null si el teléfono no es válido */
export function enlaceTel(tel: string | null | undefined): string | null {
  const t = tel?.trim()
  if (!t || !RE_TEL.test(t)) return null
  return 'tel:' + encodeURIComponent(t.replace(/ /g, ''))
}

/** Solo deja pasar https: y tel: (por si algún día el enlace viniera de fuera) */
export function esquemaPermitido(url: string): boolean {
  try {
    const p = new URL(url).protocol
    return p === 'https:' || p === 'tel:'
  } catch {
    return false
  }
}
