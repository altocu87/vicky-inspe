// Piezas comunes de las herramientas del servidor MCP.
import type { Backend, Resultado } from '../data/backend'
import { addDias } from '../lib/fechas'
import { FESTIVOS_ALBACETE } from '../lib/festivosAlbacete'
import { mapaFestivos, type Festivo } from '../lib/habiles'
import type { Orden } from '../lib/ordenes'
import type { ContextoPlazos } from '../lib/plazos/motor'
import { combinarReglas, type Regla } from '../lib/plazos/reglas'
import { combinarTipos, type TipoCita } from '../lib/eventos'
import { normal } from '../lib/filtros'

export { normal }
import type { Reloj } from './reloj'
import { hoyMadrid } from './reloj'

/**
 * Lo ÚNICO que el servidor MCP puede hacer con los datos. Sale de la misma capa que usa la web
 * (src/data), pero sin NINGUNA función de borrar ni de tocar los ajustes (festivos, reglas, tipos):
 * así, aunque alguien lo intentara, el código ni siquiera tiene forma de hacerlo.
 */
export type DatosMcp = Pick<
  Backend,
  | 'listarOrdenes'
  | 'crearOrden'
  | 'actualizarOrden'
  | 'listarFestivos'
  | 'listarReglas'
  | 'listarEventos'
  | 'listarVisitasFuturas'
  | 'listarEventosDeTipos'
  | 'listarAgendaOrden'
  | 'obtenerEvento'
  | 'crearEvento'
  | 'actualizarEvento'
  | 'listarTareas'
  | 'obtenerTarea'
  | 'crearTarea'
  | 'actualizarTarea'
  | 'listarHistorial'
  | 'listarTipos'
>

/** Error que se le puede enseñar a la usuaria tal cual (sin detalles internos) */
export class ErrorHerramienta extends Error {}

/** Lo que recibe cada herramienta: los datos (con la sesión de la usuaria), el reloj y «hoy» en España */
export interface Ctx {
  datos: DatosMcp
  reloj: Reloj
  hoy: string
  /** Caché de UNA petición (no se guarda nada entre peticiones) */
  cache: Map<string, Promise<unknown>>
}

export function nuevoCtx(datos: DatosMcp, reloj: Reloj): Ctx {
  return { datos, reloj, hoy: hoyMadrid(reloj), cache: new Map() }
}

/** Saca el dato o lanza un error comprensible */
export async function leer<T>(p: Promise<Resultado<T>>): Promise<T> {
  const r = await p
  if (r.error !== null) throw new ErrorHerramienta(r.error)
  return r.data
}

function enCache<T>(ctx: Ctx, clave: string, f: () => Promise<T>): Promise<T> {
  if (!ctx.cache.has(clave)) ctx.cache.set(clave, f())
  return ctx.cache.get(clave) as Promise<T>
}

export const ordenes = (ctx: Ctx) => enCache(ctx, 'ordenes', () => leer(ctx.datos.listarOrdenes()))

export const tipos = (ctx: Ctx): Promise<TipoCita[]> =>
  enCache(ctx, 'tipos', async () => {
    const r = await ctx.datos.listarTipos()
    return combinarTipos(r.error === null ? r.data : [])
  })

/** Festivos del año pasado a dentro de dos (como la web); si fallan, los incluidos en la app */
export const festivos = (ctx: Ctx): Promise<Festivo[]> =>
  enCache(ctx, 'festivos', async () => {
    const anio = Number(ctx.hoy.slice(0, 4))
    const r = await ctx.datos.listarFestivos(`${anio - 1}-01-01`, `${anio + 2}-12-31`)
    return r.error === null ? r.data : [...FESTIVOS_ALBACETE]
  })

export const reglas = (ctx: Ctx): Promise<Regla[]> =>
  enCache(ctx, 'reglas', async () => {
    const r = await ctx.datos.listarReglas()
    return combinarReglas(r.error === null ? r.data : [])
  })

/** Contexto del motor de plazos, igual que lo monta la web (App.tsx) */
export const contextoPlazos = (ctx: Ctx): Promise<ContextoPlazos> =>
  enCache(ctx, 'contexto', async () => {
    const [rs, fs] = await Promise.all([reglas(ctx), festivos(ctx)])
    const tiposPlazo = rs.filter((r) => r.activa && 'evento' in r.partida).map((r) => ('evento' in r.partida ? r.partida.evento : ''))
    let eventos: ContextoPlazos['eventos']
    if (tiposPlazo.length) {
      const evs = await leer(ctx.datos.listarEventosDeTipos(tiposPlazo))
      eventos = evs.filter((e) => e.orden_id && e.estado !== 'cancelada').map((e) => ({ orden_id: e.orden_id!, tipo: e.tipo, fecha: e.fecha }))
    }
    return { hoy: ctx.hoy, reglas: rs, festivos: mapaFestivos(fs), eventos }
  })

/** Busca UNA orden por su id o por su nº de orden (exacto, sin distinguir mayúsculas) */
export async function buscarOrden(ctx: Ctx, ref: { orden_id?: string; num_orden?: string }): Promise<Orden> {
  const lista = await ordenes(ctx)
  if (ref.orden_id) {
    const o = lista.find((x) => x.id === ref.orden_id!.toLowerCase())
    if (!o) throw new ErrorHerramienta('No encuentro esa orden. Búscala primero con buscar_ordenes.')
    return o
  }
  if (ref.num_orden) {
    const n = normal(ref.num_orden)
    const iguales = lista.filter((x) => normal(x.num_orden) === n)
    if (iguales.length === 1) return iguales[0]
    if (iguales.length > 1) throw new ErrorHerramienta(`Hay ${iguales.length} órdenes con el nº ${ref.num_orden}. Usa su id (sale en buscar_ordenes).`)
    throw new ErrorHerramienta(`No hay ninguna orden con el nº ${ref.num_orden}. Búscala con buscar_ordenes.`)
  }
  throw new ErrorHerramienta('Indica la orden: su id o su nº de orden.')
}

/** Días entre hoy y hoy + n */
export const masDias = (ctx: Ctx, n: number) => addDias(ctx.hoy, n)
