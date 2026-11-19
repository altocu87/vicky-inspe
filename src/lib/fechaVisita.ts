// Conversión del texto heredado del Excel `fecha_visita` en visitas del calendario.
// El texto original NO se toca: solo se leen las fechas «dd/mm/aaaa» que se entienden sin duda.
// La misma lógica está en SQL en supabase/conversiones/ (se comprueba que dan lo mismo).
import { esIso } from './fechas'
import type { EstadoEvento } from './eventos'

export type ResultadoConversion =
  | { tipo: 'vacio' } // nada que convertir (vacío o «NO VISITA»)
  | { tipo: 'ok'; visitas: { fecha: string; estado: EstadoEvento }[]; segunSecuencia: boolean }
  | { tipo: 'dudoso'; motivo: string }

const RE_FECHA = /(\d{2})\/(\d{2})\/(\d{4})/g
/** Lo que puede acompañar a las fechas sin que el texto sea dudoso: espacios y separadores */
const RE_SEPARADORES = /^[\s,;.\-–yY]*$/

/** Secuencia de resultados que indica `estado_visita` (null si no se reconoce) */
export function secuenciaEstado(estadoVisita: string | null): EstadoEvento[] | null {
  const e = (estadoVisita ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
  switch (e) {
    case '':
    case 'SIN VISITA':
      return []
    case '1º FALLIDA':
      return ['fallida']
    case '1º FALLIDA, 2º FALLIDA':
      return ['fallida', 'fallida']
    case '1º FALLIDA, REALIZADA':
      return ['fallida', 'hecha']
    case 'REALIZADA':
      return ['hecha']
    default:
      return null
  }
}

export function convertirFechaVisita(texto: string | null, estadoVisita: string | null, hoy: string): ResultadoConversion {
  const t = (texto ?? '').trim()
  if (!t || /^NO VISITA$/i.test(t)) return { tipo: 'vacio' }
  const fechas: string[] = []
  for (const m of t.matchAll(RE_FECHA)) {
    const iso = `${m[3]}-${m[2]}-${m[1]}`
    if (!esIso(iso)) return { tipo: 'dudoso', motivo: `Fecha imposible: ${m[0]}` }
    fechas.push(iso)
  }
  const resto = t.replace(RE_FECHA, '')
  if (!fechas.length) return { tipo: 'dudoso', motivo: 'No hay ninguna fecha dd/mm/aaaa' }
  if (!RE_SEPARADORES.test(resto)) return { tipo: 'dudoso', motivo: 'Hay texto además de las fechas' }
  const unicas = [...new Set(fechas)].sort()
  const sec = secuenciaEstado(estadoVisita)
  // Encaja con la secuencia: mismo número de fechas, o una más si la última es futura (pendiente)
  if (sec && sec.length > 0 && unicas.length === sec.length) {
    return { tipo: 'ok', visitas: unicas.map((fecha, i) => ({ fecha, estado: sec[i] })), segunSecuencia: true }
  }
  if (sec && sec.length > 0 && unicas.length === sec.length + 1 && unicas[unicas.length - 1] >= hoy) {
    return {
      tipo: 'ok',
      visitas: unicas.map((fecha, i) => ({ fecha, estado: i < sec.length ? sec[i] : 'pendiente' })),
      segunSecuencia: true,
    }
  }
  // Si no encaja: las futuras pendientes y las pasadas hechas
  return { tipo: 'ok', visitas: unicas.map((fecha) => ({ fecha, estado: fecha >= hoy ? 'pendiente' : 'hecha' })), segunSecuencia: false }
}

/** Título de la visita convertida: «Visita (Excel)», o «1ª visita (Excel)», «2ª visita (Excel)»… si hay varias */
export const tituloVisitaExcel = (numero: number, total: number) => (total > 1 ? `${numero}ª visita (Excel)` : 'Visita (Excel)')

/** Clave única de una visita convertida (orden + fecha): así se puede repetir sin duplicar */
export const claveExcel = (ordenId: string, fecha: string) => `excel:${ordenId}:${fecha}`

export interface ResumenConversion {
  ordenes: number
  conFechas: number
  visitas: number
  porEstado: Record<EstadoEvento, number>
  segunSecuencia: number
  sinSecuencia: number
  dudosos: { id: string; num_orden: string; texto: string; motivo: string }[]
}

/** Simulación: qué saldría de convertir todas las órdenes */
export function simularConversion(
  ordenes: readonly { id: string; num_orden: string; fecha_visita: string | null; estado_visita: string | null }[],
  hoy: string,
): ResumenConversion {
  const r: ResumenConversion = {
    ordenes: ordenes.length,
    conFechas: 0,
    visitas: 0,
    porEstado: { pendiente: 0, hecha: 0, fallida: 0, cancelada: 0 },
    segunSecuencia: 0,
    sinSecuencia: 0,
    dudosos: [],
  }
  for (const o of ordenes) {
    const c = convertirFechaVisita(o.fecha_visita, o.estado_visita, hoy)
    if (c.tipo === 'dudoso') r.dudosos.push({ id: o.id, num_orden: o.num_orden, texto: o.fecha_visita ?? '', motivo: c.motivo })
    if (c.tipo !== 'ok') continue
    r.conFechas++
    r.visitas += c.visitas.length
    for (const v of c.visitas) r.porEstado[v.estado]++
    if (c.segunSecuencia) r.segunSecuencia++
    else r.sinSecuencia++
  }
  return r
}
