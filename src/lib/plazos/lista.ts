// Vista «Plazos»: lista cronológica de fechas límite, agrupada por semana.
import { addDias, diasEntre, finDeMes, lunesDe, nombreMes } from '../fechas'
import type { Orden } from '../ordenes'
import { plazosVigilados, type ContextoPlazos, type Nivel, type PlazoCalc } from './motor'

export interface LineaPlazo {
  orden: Orden
  plazo: PlazoCalc
}

export type IdGrupo = 'vencidos' | 'semana' | 'siguiente' | 'mes' | string // 'aaaa-mm' para «después»

export interface Grupo {
  id: IdGrupo
  titulo: string
  lineas: LineaPlazo[]
}

export interface FiltroPlazos {
  reglas?: readonly string[] // ids de regla; vacío o undefined = todas
  niveles?: readonly Nivel[]
  ordenId?: string | null
}

/** Todas las líneas de plazo de las órdenes dadas, filtradas y por fecha (y nº de orden) */
export function lineasPlazos(ordenes: readonly Orden[], ctx: ContextoPlazos, f: FiltroPlazos = {}): LineaPlazo[] {
  const out: LineaPlazo[] = []
  for (const o of ordenes) {
    if (o.estado === 'FINALIZADA') continue
    if (f.ordenId && o.id !== f.ordenId) continue
    for (const p of plazosVigilados(o, ctx)) {
      if (f.reglas?.length && !f.reglas.includes(p.regla.id)) continue
      if (f.niveles?.length && !f.niveles.includes(p.nivel)) continue
      out.push({ orden: o, plazo: p })
    }
  }
  return out.sort((a, b) => a.plazo.fecha.localeCompare(b.plazo.fecha) || a.orden.num_orden.localeCompare(b.orden.num_orden, 'es', { numeric: true }))
}

/**
 * Agrupa: Vencidos · Esta semana (lun–dom) · La semana que viene · Resto de este mes · y después, por meses.
 * Las líneas deben venir ordenadas por fecha.
 */
export function agruparPlazos(lineas: readonly LineaPlazo[], hoy: string): Grupo[] {
  const finSemana = addDias(lunesDe(hoy), 6)
  const finSiguiente = addDias(finSemana, 7)
  const finMes = finDeMes(hoy)
  const grupos = new Map<IdGrupo, Grupo>()
  const meter = (id: IdGrupo, titulo: string, l: LineaPlazo) => {
    if (!grupos.has(id)) grupos.set(id, { id, titulo, lineas: [] })
    grupos.get(id)!.lineas.push(l)
  }
  for (const l of lineas) {
    const f = l.plazo.fecha
    if (diasEntre(hoy, f) < 0) meter('vencidos', 'Vencidos', l)
    else if (f <= finSemana) meter('semana', 'Esta semana', l)
    else if (f <= finSiguiente) meter('siguiente', 'La semana que viene', l)
    else if (f <= finMes) meter('mes', 'Resto de este mes', l)
    else {
      const t = nombreMes(f)
      meter(f.slice(0, 7), t.charAt(0).toUpperCase() + t.slice(1), l)
    }
  }
  return [...grupos.values()]
}
