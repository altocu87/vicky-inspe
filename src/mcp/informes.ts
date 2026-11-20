// Herramienta de INFORMES (solo lectura): semanal, vencidos, mensual y estadísticas por mes.
import { z } from 'zod'
import { addDias, diaSemana, diasEntre, finDeMes, nombreMes } from '../lib/fechas'
import { mapaFestivos } from '../lib/habiles'
import { lineasPlazos } from '../lib/plazos/lista'
import { desplegar } from '../lib/repeticion'
import { tareasOficina } from '../lib/semana'
import { ordenesConVisitaFutura, porProgramar } from '../lib/porProgramar'
import { ErrorHerramienta, contextoPlazos, festivos, leer, ordenes, tipos, type Ctx } from './comun'
import { diaYFecha, dma, lineaEvento, lineaOrden, lineaTarea, textoPlazo } from './formato'
import { herramienta } from './herramienta'

const RE_MES = /^(19|20|21)\d\d-(0[1-9]|1[0-2])$/

/** Próximo domingo (hoy, si hoy es domingo) */
const proximoDomingo = (hoy: string) => addDias(hoy, (7 - diaSemana(hoy)) % 7)

async function semanal(ctx: Ctx): Promise<string> {
  const dom = proximoDomingo(ctx.hoy)
  const lun = addDias(dom, 1)
  const fin = addDias(dom, 6)
  const [lista, pc, evs, tars, ts, fs, vis] = await Promise.all([
    ordenes(ctx),
    contextoPlazos(ctx),
    leer(ctx.datos.listarEventos(dom, lun)),
    leer(ctx.datos.listarTareas(ctx.hoy, fin)),
    tipos(ctx),
    festivos(ctx),
    leer(ctx.datos.listarVisitasFuturas(ctx.hoy)),
  ])
  const ords = new Map(lista.map((o) => [o.id, o]))
  const mt = new Map(ts.map((t) => [t.id, t]))
  const fest = mapaFestivos(fs)
  const out: string[] = [`Resumen de la semana del ${diaYFecha(dom)} al ${diaYFecha(fin)} (hoy es ${diaYFecha(ctx.hoy)})`]

  const ls = lineasPlazos(lista, pc)
  const vencidos = ls.filter((x) => x.plazo.dias < 0)
  const semana = ls.filter((x) => x.plazo.dias >= 0 && x.plazo.fecha <= fin)
  out.push(
    `PLAZOS · vencidos: ${vencidos.length} · vencen hasta el ${dma(fin)}: ${semana.length}` +
      (semana.length ? '\n' + semana.map((x) => `• ${textoPlazo(x.plazo, ctx.hoy)} · ${lineaOrden(x.orden)}`).join('\n') : ''),
  )

  const ocs = desplegar(evs, dom, lun).filter((oc) => oc.evento.estado !== 'cancelada')
  for (const d of [dom, lun]) {
    const del = ocs.filter((oc) => oc.fecha === d)
    const f = fest.get(d)
    out.push(
      `${d === dom ? 'DOMINGO' : 'LUNES'} ${dma(d)}${f ? ` (festivo: ${f.nombre})` : ''} · ${del.length} visita(s)/cita(s)` +
        (del.length ? '\n' + del.map((oc) => '• ' + lineaEvento(oc.evento, oc.fecha, mt, oc.evento.orden_id ? ords.get(oc.evento.orden_id) : undefined, false, false)).join('\n') : ''),
    )
  }

  const ofi = tareasOficina(tars, lun, ctx.hoy)
  out.push(`OFICINA (lunes ${dma(lun)}) · ${ofi.length} tarea(s)` + (ofi.length ? '\n' + ofi.map((t) => '• ' + lineaTarea(t, t.orden_id ? ords.get(t.orden_id) : undefined, false)).join('\n') : ''))

  const otras = tars.filter((t) => !t.hecha && !t.oficina && t.vence && t.vence <= fin)
  if (otras.length) out.push(`OTRAS TAREAS hasta el ${dma(fin)} (incluye atrasadas) · ${otras.length}\n` + otras.map((t) => '• ' + lineaTarea(t, t.orden_id ? ords.get(t.orden_id) : undefined, false)).join('\n'))

  const pp = porProgramar(lista, [], ordenesConVisitaFutura(vis, ctx.hoy), pc)
  out.push(`POR PROGRAMAR: ${pp.length} orden(es) con plazo a menos de 30 días y sin visita` + (pp.length ? ' (pídeme «por programar» para verlas)' : ''))
  return out.join('\n\n')
}

async function vencidos(ctx: Ctx): Promise<string> {
  const [lista, pc] = await Promise.all([ordenes(ctx), contextoPlazos(ctx)])
  const v = lineasPlazos(lista, pc).filter((x) => x.plazo.dias < 0)
  if (!v.length) return 'No hay ningún plazo vencido.'
  const n = new Set(v.map((x) => x.orden.id)).size
  return `Plazos vencidos: ${v.length} (en ${n} orden/es), del más antiguo al más reciente:\n` + v.map((x) => `• ${textoPlazo(x.plazo, ctx.hoy)} · ${lineaOrden(x.orden)} · id: ${x.orden.id}`).join('\n')
}

async function mensual(ctx: Ctx, mes: string): Promise<string> {
  const desde = `${mes}-01`
  const hasta = finDeMes(desde)
  const [lista, pc, evs, ts] = await Promise.all([ordenes(ctx), contextoPlazos(ctx), leer(ctx.datos.listarEventos(desde, hasta)), tipos(ctx)])
  const ords = new Map(lista.map((o) => [o.id, o]))
  const mt = new Map(ts.map((t) => [t.id, t]))
  const recibidas = lista.filter((o) => o.fecha_orden && o.fecha_orden >= desde && o.fecha_orden <= hasta)
  const cerradas = lista.filter((o) => o.estado === 'FINALIZADA' && o.fecha_cierre && o.fecha_cierre >= desde && o.fecha_cierre <= hasta)
  const pls = lineasPlazos(lista, pc).filter((x) => x.plazo.fecha >= desde && x.plazo.fecha <= hasta)
  const ocs = desplegar(evs, desde, hasta).filter((oc) => oc.evento.estado !== 'cancelada' && oc.fecha >= desde)
  const visitas = ocs.filter((oc) => oc.evento.tipo === 'visita')
  const cuenta = (e: string) => visitas.filter((oc) => oc.evento.estado === e).length
  const out = [
    `Informe de ${nombreMes(desde)}`,
    `Órdenes recibidas: ${recibidas.length} · cerradas: ${cerradas.length}`,
    `Visitas: ${visitas.length} (hechas ${cuenta('hecha')}, fallidas ${cuenta('fallida')}, pendientes ${cuenta('pendiente')}) · otras citas: ${ocs.length - visitas.length}`,
    `Plazos que vencen en el mes (órdenes activas): ${pls.length}` + (pls.length ? '\n' + pls.map((x) => `• ${textoPlazo(x.plazo, ctx.hoy)} · ${lineaOrden(x.orden)}`).join('\n') : ''),
  ]
  if (ocs.length) out.push('Visitas y citas del mes:\n' + ocs.map((oc) => '• ' + lineaEvento(oc.evento, oc.fecha, mt, oc.evento.orden_id ? ords.get(oc.evento.orden_id) : undefined, false)).join('\n'))
  return out.join('\n\n')
}

async function estadisticas(ctx: Ctx, anio: number): Promise<string> {
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-31`
  const [lista, evs] = await Promise.all([ordenes(ctx), leer(ctx.datos.listarEventos(desde, hasta))])
  const filas: string[] = []
  let tot = { rec: 0, cer: 0, dias: 0, conDias: 0, hechas: 0, fallidas: 0 }
  for (let m = 1; m <= 12; m++) {
    const mes = `${anio}-${String(m).padStart(2, '0')}`
    if (`${mes}-01` > ctx.hoy) break
    const en = (f: string | null) => !!f && f.startsWith(mes)
    const rec = lista.filter((o) => en(o.fecha_orden)).length
    const cerradas = lista.filter((o) => o.estado === 'FINALIZADA' && en(o.fecha_cierre))
    const conDias = cerradas.filter((o) => o.fecha_orden && o.fecha_cierre! >= o.fecha_orden)
    const dias = conDias.reduce((s, o) => s + diasEntre(o.fecha_orden!, o.fecha_cierre!), 0)
    // Visitas marcadas (las excepciones de una serie cuentan; la serie en sí, no)
    const vis = evs.filter((e) => e.tipo === 'visita' && !e.rrule && en(e.fecha))
    const hechas = vis.filter((e) => e.estado === 'hecha').length
    const fallidas = vis.filter((e) => e.estado === 'fallida').length
    tot = { rec: tot.rec + rec, cer: tot.cer + cerradas.length, dias: tot.dias + dias, conDias: tot.conDias + conDias.length, hechas: tot.hechas + hechas, fallidas: tot.fallidas + fallidas }
    filas.push(`${nombreMes(`${mes}-01`)}: recibidas ${rec} · cerradas ${cerradas.length} · días medios para cerrar ${conDias.length ? Math.round(dias / conDias.length) : '—'} · visitas hechas ${hechas} · fallidas ${fallidas}`)
  }
  if (!filas.length) return `Aún no hay datos de ${anio}.`
  const activas = lista.filter((o) => o.estado !== 'FINALIZADA').length
  return (
    `Estadísticas de ${anio} (por mes):\n` +
    filas.map((f) => '• ' + f).join('\n') +
    `\n\nTotal ${anio}: recibidas ${tot.rec} · cerradas ${tot.cer} · días medios para cerrar ${tot.conDias ? Math.round(tot.dias / tot.conDias) : '—'} · visitas hechas ${tot.hechas} · fallidas ${tot.fallidas}` +
    `\nÓrdenes activas hoy: ${activas}`
  )
}

export const informe = herramienta({
  nombre: 'informe',
  titulo: 'Informes',
  descripcion:
    'Informes: «semanal» (lo de la semana que viene: plazos, visitas del domingo y del lunes, tareas para la oficina y lo que falta por programar), ' +
    '«vencidos» (todos los plazos vencidos), «mensual» (un mes: órdenes recibidas y cerradas, visitas, plazos) y ' +
    '«estadisticas» (un año por meses: recibidas, cerradas, días medios para cerrar, visitas hechas y fallidas).',
  entrada: z.strictObject({
    tipo: z.enum(['semanal', 'vencidos', 'mensual', 'estadisticas']),
    mes: z.string().regex(RE_MES, { message: 'Mes no válido: usa aaaa-mm' }).optional().describe('Para «mensual»: aaaa-mm (por defecto, el mes actual)'),
    anio: z.number().int().min(2020).max(2100).optional().describe('Para «estadisticas» (por defecto, el año actual)'),
  }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    switch (a.tipo) {
      case 'semanal':
        return semanal(ctx)
      case 'vencidos':
        return vencidos(ctx)
      case 'mensual':
        return mensual(ctx, a.mes ?? ctx.hoy.slice(0, 7))
      case 'estadisticas': {
        const anio = a.anio ?? Number(ctx.hoy.slice(0, 4))
        if (`${anio}-01-01` > ctx.hoy) throw new ErrorHerramienta('Ese año aún no ha empezado.')
        return estadisticas(ctx, anio)
      }
    }
  },
})

export const HERRAMIENTAS_INFORMES = [informe]
