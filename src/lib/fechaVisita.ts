// Conversión del texto heredado del Excel `fecha_visita` en visitas del calendario.
// El texto original NO se toca: solo se leen las fechas que se entienden sin duda
// («dd/mm/aaaa», «d/m/aaaa», «dd-mm-aa»), con palabras como «1º visita el…» o «FALLIDA».
// La misma lógica está en SQL en supabase/conversiones/ (se comprueba que dan lo mismo).
import { esIso } from './fechas'
import type { EstadoEvento } from './eventos'

export type ResultadoConversion =
  | { tipo: 'vacio' } // nada que convertir (vacío o «NO VISITA»)
  | {
      tipo: 'ok'
      visitas: { fecha: string; estado: EstadoEvento }[]
      segunSecuencia: boolean
      /** Si el texto traía algo más que fechas, se guarda entero en los detalles de la visita */
      notas: string | null
    }
  | { tipo: 'dudoso'; motivo: string }

/**
 * Fecha «d/m/aaaa», «dd/mm/aaaa», «dd-mm-aa»… (día y mes de 1 o 2 cifras; año de 4 o 2 cifras = 20aa),
 * opcionalmente seguida de «FALLIDA» (esa visita fue fallida). Se aplica al texto en MAYÚSCULAS.
 */
const RE_FECHA = /(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)(\s*FALLIDA)?/g
/** Solo la fecha (para ver qué otras palabras trae el texto) */
const RE_SOLO_FECHA = /(?<!\d)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?!\d)/g
/** Separadores entre palabras */
const RE_SEP = /[\s,;.–-]+/
/** Palabras que pueden acompañar a las fechas sin que el texto sea dudoso («1º visita el…», «FALLIDA») */
const RE_PALABRA_OK = /^(VISITA|EL|Y|FALLIDA|\d[ºª])$/

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
  const u = t.toUpperCase()
  const fechas: string[] = []
  const fallidas = new Set<string>()
  for (const m of u.matchAll(RE_FECHA)) {
    const anio = m[3].length === 2 ? '20' + m[3] : m[3]
    const iso = `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    if (!esIso(iso)) return { tipo: 'dudoso', motivo: `Fecha imposible: ${m[1]}/${m[2]}/${m[3]}` }
    fechas.push(iso)
    if (m[4]) fallidas.add(iso)
  }
  if (!fechas.length) return { tipo: 'dudoso', motivo: 'No hay ninguna fecha' }
  const palabras = u.replace(RE_SOLO_FECHA, ' ').split(RE_SEP).filter(Boolean)
  if (!palabras.every((p) => RE_PALABRA_OK.test(p))) return { tipo: 'dudoso', motivo: 'Hay texto que no se entiende' }
  const notas = palabras.length ? `Texto del Excel: «${t}»` : null
  const unicas = [...new Set(fechas)].sort()
  const sec = secuenciaEstado(estadoVisita)
  let visitas: { fecha: string; estado: EstadoEvento }[]
  let segunSecuencia = true
  if (sec && sec.length > 0 && unicas.length === sec.length) {
    // Encaja con la secuencia: mismo número de fechas
    visitas = unicas.map((fecha, i) => ({ fecha, estado: sec[i] }))
  } else if (sec && sec.length > 0 && unicas.length === sec.length + 1 && unicas[unicas.length - 1] >= hoy) {
    // … o una más, si la última es futura (pendiente)
    visitas = unicas.map((fecha, i) => ({ fecha, estado: i < sec.length ? sec[i] : 'pendiente' }))
  } else {
    // Si no encaja: las futuras pendientes y las pasadas hechas
    segunSecuencia = false
    visitas = unicas.map((fecha) => ({ fecha, estado: fecha >= hoy ? 'pendiente' : 'hecha' }))
  }
  // «dd/mm/aaaa FALLIDA» manda sobre lo anterior
  visitas = visitas.map((v) => (fallidas.has(v.fecha) ? { ...v, estado: 'fallida' } : v))
  return { tipo: 'ok', visitas, segunSecuencia, notas }
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
