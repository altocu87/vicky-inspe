// Herramientas de LECTURA: no cambian nada (van marcadas como «solo lectura»).
import { z } from 'zod'
import { addDias } from '../lib/fechas'
import { mapaFestivos } from '../lib/habiles'
import { label } from '../lib/ordenes'
import { NIVELES, plazosVigilados, proximoPlazo, type Nivel } from '../lib/plazos/motor'
import { agruparPlazos, lineasPlazos } from '../lib/plazos/lista'
import { desplegar } from '../lib/repeticion'
import { proximoHuecoVisita, tareasOficina, visitasPorDia, esOficina, DIAS_VISITA } from '../lib/semana'
import { ordenesConVisitaFutura, porProgramar } from '../lib/porProgramar'
import { construirHistorial } from '../lib/historial'
import { ErrorHerramienta, buscarOrden, contextoPlazos, festivos, leer, normal, ordenes, tipos, type Ctx } from './comun'
import { comprobarRango, estadoOrden, fecha, limite, numOrden, texto, uuid } from './esquemas'
import { cuando, diaYFecha, dma, lineaEvento, lineaOrden, lineaTarea, pieLimite, textoPlazo } from './formato'
import { herramienta } from './herramienta'
import { aHoraLocalMadrid } from './reloj'

/** Campos de texto libre de la orden: pueden llevar datos personales, solo salen si se piden */
export const CAMPOS_LIBRES = ['objeto', 'situacion_general', 'tareas_pendientes', 'fecha_visita'] as const

const AVISO_DETALLES = 'Ponlo a true SOLO si la usuaria pide expresamente ver notas, detalles, direcciones o teléfonos.'

/** Referencia a una orden: por id o por nº de orden */
export const refOrden = {
  orden_id: uuid.optional().describe('Id de la orden (sale en buscar_ordenes)'),
  num_orden: numOrden.optional().describe('Nº de orden exacto, si no tienes el id'),
}

const porId = async (ctx: Ctx) => new Map((await ordenes(ctx)).map((o) => [o.id, o]))
const mapaTipos = async (ctx: Ctx) => new Map((await tipos(ctx)).map((t) => [t.id, t]))

// ---------------------------------------------------------------------------------------------

export const buscarOrdenes = herramienta({
  nombre: 'buscar_ordenes',
  titulo: 'Buscar órdenes',
  descripcion:
    'Busca órdenes de inspección por nº de orden o por empresa (sin distinguir tildes ni mayúsculas) y/o por estado. ' +
    'Devuelve nº, empresa, estado, próximo plazo e id. Sin texto, lista las órdenes activas ordenadas por el plazo más cercano.',
  entrada: z.strictObject({
    texto: texto(60).optional().describe('Parte del nº de orden o del nombre de la empresa'),
    estado: z.union([estadoOrden, z.literal('ACTIVAS'), z.literal('TODAS')]).default('ACTIVAS').describe('ACTIVAS = todas menos FINALIZADA'),
    limite: limite(20, 50),
  }),
  clase: 'lectura',
  async ejecutar({ texto: q, estado, limite: max }, ctx) {
    const [lista, pc] = await Promise.all([ordenes(ctx), contextoPlazos(ctx)])
    const n = q ? normal(q) : ''
    const hallados = lista
      .filter((o) => (estado === 'TODAS' ? true : estado === 'ACTIVAS' ? o.estado !== 'FINALIZADA' : o.estado === estado))
      .filter((o) => !n || normal(o.num_orden).includes(n) || normal(o.empresa).includes(n))
      .map((o) => ({ o, p: o.estado === 'FINALIZADA' ? null : proximoPlazo(o, pc) }))
      .sort((a, b) => (a.p?.fecha ?? '9999').localeCompare(b.p?.fecha ?? '9999') || a.o.num_orden.localeCompare(b.o.num_orden, 'es', { numeric: true }))
    if (!hallados.length) return 'No hay ninguna orden que encaje con esa búsqueda.'
    const lineas = hallados.slice(0, max).map(({ o, p }) => `• ${lineaOrden(o)}${p ? ` · próximo plazo ${textoPlazo(p, ctx.hoy)}` : ''} · id: ${o.id}`)
    return `${hallados.length} orden(es):\n${lineas.join('\n')}${pieLimite(hallados.length, lineas.length)}`
  },
})

// ---------------------------------------------------------------------------------------------

export const verOrden = herramienta({
  nombre: 'ver_orden',
  titulo: 'Ver una orden',
  descripcion:
    'Ficha de UNA orden: datos básicos, fechas, plazos, visitas y citas, y tareas. ' +
    'Por privacidad, los textos libres (objeto, situación, notas), direcciones y teléfonos NO salen salvo con incluir_detalles.',
  entrada: z
    .strictObject({ ...refOrden, incluir_detalles: z.boolean().default(false).describe(AVISO_DETALLES) })
    .refine((a) => a.orden_id || a.num_orden, { message: 'Indica orden_id o num_orden' }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const o = await buscarOrden(ctx, a)
    const [pc, agenda, ts] = await Promise.all([contextoPlazos(ctx), leer(ctx.datos.listarAgendaOrden(o.id)), mapaTipos(ctx)])
    const l: string[] = [`Orden ${lineaOrden(o)} (id: ${o.id})`]
    l.push(`Fecha de la orden: ${dma(o.fecha_orden)} · 1.ª actuación: ${dma(o.fecha_primera_actuacion)} · última actuación: ${dma(o.fecha_ultima_actuacion)}`)
    if (o.estado === 'FINALIZADA') l.push(`Cerrada el ${dma(o.fecha_cierre)}`)
    l.push(`Documentación: ${label(o.estado_docum)} · estado de la visita: ${label(o.estado_visita)}`)
    l.push(`Subido: comparecencia ${label(o.comparecencia_subida)} · documentación ${label(o.doc_subida)} · claves ${label(o.claves)}`)
    const ps = o.estado === 'FINALIZADA' ? [] : plazosVigilados(o, pc)
    l.push(ps.length ? `Plazos:\n${ps.map((p) => `  - ${textoPlazo(p, ctx.hoy)}`).join('\n')}` : 'Plazos: ninguno vigilado')
    const evs = agenda.eventos.filter((e) => e.estado !== 'cancelada').sort((x, y) => x.fecha.localeCompare(y.fecha))
    l.push(evs.length ? `Visitas y citas (${evs.length}):\n${evs.map((e) => '  - ' + lineaEvento(e, e.fecha, ts, undefined, a.incluir_detalles)).join('\n')}` : 'Visitas y citas: ninguna')
    const pend = agenda.tareas.filter((t) => !t.hecha)
    if (pend.length) l.push(`Tareas pendientes (${pend.length}):\n${pend.map((t) => '  - ' + lineaTarea(t, undefined, a.incluir_detalles)).join('\n')}`)
    if (a.incluir_detalles) {
      if (o.objeto) l.push(`Objeto: ${o.objeto}`)
      if (o.situacion_general) l.push(`Situación general: ${o.situacion_general}`)
      if (o.tareas_pendientes) l.push(`Tareas pendientes (texto): ${o.tareas_pendientes}`)
      if (o.fecha_visita) l.push(`Notas de visita (Excel): ${o.fecha_visita}`)
    }
    return l.join('\n')
  },
})

// ---------------------------------------------------------------------------------------------

const nivelesEntrada = z.array(z.enum(NIVELES as unknown as [Nivel, ...Nivel[]])).max(4)

export const plazos = herramienta({
  nombre: 'plazos',
  titulo: 'Plazos que vencen',
  descripcion:
    'Fechas límite de las órdenes activas entre dos días, agrupadas (vencidos, esta semana, la que viene, este mes, después). ' +
    'Sin fechas: los vencidos y los de los próximos 30 días. Niveles: vencido, urgente (≤30 días), medio (31-90), ok (>90).',
  entrada: z.strictObject({
    desde: fecha.optional(),
    hasta: fecha.optional(),
    niveles: nivelesEntrada.optional(),
    incluir_vencidos: z.boolean().default(true).describe('Incluir siempre los ya vencidos aunque sean anteriores a «desde»'),
    limite: limite(60, 150),
  }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const desde = a.desde ?? ctx.hoy
    const hasta = a.hasta ?? addDias(ctx.hoy, 30)
    const err = comprobarRango(desde, hasta, 800)
    if (err) throw new ErrorHerramienta(err)
    const [lista, pc] = await Promise.all([ordenes(ctx), contextoPlazos(ctx)])
    const lineas = lineasPlazos(lista, pc, { niveles: a.niveles }).filter(
      (x) => (x.plazo.fecha >= desde && x.plazo.fecha <= hasta) || (a.incluir_vencidos && x.plazo.dias < 0 && x.plazo.fecha < desde),
    )
    if (!lineas.length) return `No hay plazos entre el ${dma(desde)} y el ${dma(hasta)}${a.incluir_vencidos ? ' ni vencidos' : ''}.`
    const usadas = lineas.slice(0, a.limite)
    const grupos = agruparPlazos(usadas, ctx.hoy)
    const txt = grupos.map((g) => `${g.titulo} (${g.lineas.length}):\n${g.lineas.map((x) => `• ${textoPlazo(x.plazo, ctx.hoy)} · ${lineaOrden(x.orden)} · id: ${x.orden.id}`).join('\n')}`)
    return `Plazos del ${dma(desde)} al ${dma(hasta)} (hoy es ${diaYFecha(ctx.hoy)}):\n\n${txt.join('\n\n')}${pieLimite(lineas.length, usadas.length)}`
  },
})

// ---------------------------------------------------------------------------------------------

export const agenda = herramienta({
  nombre: 'agenda',
  titulo: 'Agenda de un día o una semana',
  descripcion:
    'Lo que hay entre dos días (como mucho 62): visitas y citas, tareas, tareas para la oficina (lunes), plazos que vencen y festivos. ' +
    'Sin «hasta», solo ese día. Direcciones, teléfonos y notas solo con incluir_detalles.',
  entrada: z.strictObject({
    desde: fecha.optional().describe('Por defecto, hoy'),
    hasta: fecha.optional(),
    incluir_detalles: z.boolean().default(false).describe(AVISO_DETALLES),
  }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const desde = a.desde ?? ctx.hoy
    const hasta = a.hasta ?? desde
    const err = comprobarRango(desde, hasta, 62)
    if (err) throw new ErrorHerramienta(err)
    const [evs, tars, ords, ts, fs, pc] = await Promise.all([
      leer(ctx.datos.listarEventos(desde, hasta)),
      leer(ctx.datos.listarTareas(desde, hasta)),
      porId(ctx),
      mapaTipos(ctx),
      festivos(ctx),
      contextoPlazos(ctx),
    ])
    const ocs = desplegar(evs, desde, hasta).filter((oc) => oc.evento.estado !== 'cancelada')
    const plazosRango = lineasPlazos([...ords.values()], pc).filter((x) => x.plazo.fecha >= desde && x.plazo.fecha <= hasta)
    const fest = mapaFestivos(fs)
    const out: string[] = []
    for (let d = desde; d <= hasta; d = addDias(d, 1)) {
      const l: string[] = []
      const f = fest.get(d)
      if (f) l.push(`  Festivo: ${f.nombre}`)
      for (const oc of ocs.filter((x) => x.fecha <= d && (x.fecha_fin ?? x.fecha) >= d && (x.fecha === d || d === desde)))
        l.push('  ' + lineaEvento(oc.evento, oc.fecha, ts, oc.evento.orden_id ? ords.get(oc.evento.orden_id) : undefined, a.incluir_detalles, oc.fecha !== d))
      for (const t of tars.filter((t) => t.vence === d && !t.oficina)) l.push('  Tarea: ' + lineaTarea(t, t.orden_id ? ords.get(t.orden_id) : undefined, a.incluir_detalles))
      if (esOficina(d)) {
        const ofi = tareasOficina(tars, d, ctx.hoy)
        if (ofi.length) l.push(`  Oficina (${ofi.length} tarea/s):\n${ofi.map((t) => '    - ' + lineaTarea(t, t.orden_id ? ords.get(t.orden_id) : undefined, a.incluir_detalles)).join('\n')}`)
      }
      for (const x of plazosRango.filter((x) => x.plazo.fecha === d)) l.push(`  Vence plazo ${x.plazo.regla.corto}: ${lineaOrden(x.orden)} · id: ${x.orden.id}`)
      if (l.length) out.push(`${diaYFecha(d)}${d === ctx.hoy ? ' (hoy)' : ''}:\n${l.join('\n')}`)
    }
    // Atrasado: tareas sin hacer de días anteriores (solo si se mira desde hoy)
    if (desde <= ctx.hoy && hasta >= ctx.hoy) {
      const atrasadas = tars.filter((t) => !t.hecha && t.vence && t.vence < ctx.hoy && !t.oficina)
      if (atrasadas.length) out.push(`Tareas atrasadas (${atrasadas.length}):\n${atrasadas.map((t) => '  - ' + lineaTarea(t, t.orden_id ? ords.get(t.orden_id) : undefined, a.incluir_detalles)).join('\n')}`)
    }
    const rango = desde === hasta ? `el ${diaYFecha(desde)}` : `del ${diaYFecha(desde)} al ${diaYFecha(hasta)}`
    return out.length ? `Agenda ${rango}:\n\n${out.join('\n\n')}` : `No hay nada en la agenda ${rango}.`
  },
})

// ---------------------------------------------------------------------------------------------

export const porProgramarH = herramienta({
  nombre: 'por_programar',
  titulo: 'Por programar',
  descripcion:
    'Lo que aún no tiene día: órdenes activas con un plazo a menos de 30 días (o vencido) y SIN visita programada, de la más urgente a la menos; ' +
    'y después las tareas sin fecha (las «para la oficina» no salen: van al lunes).',
  entrada: z.strictObject({ limite: limite(30, 100) }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const [lista, pc, vis, tars] = await Promise.all([
      ordenes(ctx),
      contextoPlazos(ctx),
      leer(ctx.datos.listarVisitasFuturas(ctx.hoy)),
      leer(ctx.datos.listarTareas(ctx.hoy, ctx.hoy)),
    ])
    const items = porProgramar(lista, tars, ordenesConVisitaFutura(vis, ctx.hoy), pc)
    if (!items.length) return 'No hay nada por programar.'
    const usados = items.slice(0, a.limite)
    const l = usados.map((i) => (i.tipo === 'orden' ? `• Orden ${lineaOrden(i.orden)} · ${textoPlazo(i.plazo, ctx.hoy)} · sin visita · id: ${i.orden.id}` : `• Tarea ${lineaTarea(i.tarea, undefined, false)}`))
    return `Por programar (${items.length}):\n${l.join('\n')}${pieLimite(items.length, usados.length)}`
  },
})

// ---------------------------------------------------------------------------------------------

export const huecoVisita = herramienta({
  nombre: 'hueco_visita',
  titulo: 'Próximo hueco para una visita',
  descripcion: 'Propone el próximo domingo o lunes LIBRE para una visita: que no sea festivo y que tenga menos de 4 visitas pendientes. Puede proponer varios.',
  entrada: z.strictObject({
    desde: fecha.optional().describe('Buscar a partir de este día (por defecto, hoy)'),
    cuantos: z.number().int().min(1).max(6).default(2),
  }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const desde = a.desde ?? ctx.hoy
    if (desde < ctx.hoy) throw new ErrorHerramienta('Busca a partir de hoy o de un día futuro.')
    const hasta = addDias(desde, 400)
    const [evs, fs] = await Promise.all([leer(ctx.datos.listarEventos(desde, hasta)), festivos(ctx)])
    const ocup = visitasPorDia(desplegar(evs, desde, hasta, 5000).map((oc) => ({ tipo: oc.evento.tipo, fecha: oc.fecha, estado: oc.evento.estado })))
    const fest = mapaFestivos(fs)
    const out: string[] = []
    let d = desde
    for (let i = 0; i < a.cuantos; i++) {
      const h = proximoHuecoVisita(d, ocup, fest)
      out.push(`• ${diaYFecha(h)} (${cuando(h, ctx.hoy)}) · ${ocup.get(h) ?? 0} visita(s) ya programada(s)`)
      d = addDias(h, 1)
    }
    const dias = DIAS_VISITA.map((x) => ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][x]).join(' y ')
    return `Días libres para visitar (${dias}, sin festivos y con menos de 4 visitas):\n${out.join('\n')}`
  },
})

// ---------------------------------------------------------------------------------------------

export const festivosH = herramienta({
  nombre: 'festivos',
  titulo: 'Festivos de Albacete',
  descripcion: 'Festivos nacionales, de Castilla-La Mancha y locales de Albacete capital que hay guardados, de un año o entre dos fechas.',
  entrada: z.strictObject({
    anio: z.number().int().min(2020).max(2100).optional(),
    desde: fecha.optional(),
    hasta: fecha.optional(),
  }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const anio = a.anio ?? Number(ctx.hoy.slice(0, 4))
    const desde = a.desde ?? `${anio}-01-01`
    const hasta = a.hasta ?? `${anio}-12-31`
    const err = comprobarRango(desde, hasta, 1100)
    if (err) throw new ErrorHerramienta(err)
    const r = await ctx.datos.listarFestivos(desde, hasta)
    const lista = r.error === null ? r.data : (await festivos(ctx)).filter((f) => f.fecha >= desde && f.fecha <= hasta)
    if (!lista.length) return `No hay festivos guardados entre el ${dma(desde)} y el ${dma(hasta)}. (Las fiestas locales de cada año se añaden en Ajustes cuando se publican.)`
    const AMB: Record<string, string> = { nacional: 'nacional', autonomico: 'Castilla-La Mancha', local: 'local (Albacete)' }
    return `Festivos del ${dma(desde)} al ${dma(hasta)}:\n${lista.map((f) => `• ${diaYFecha(f.fecha)} · ${f.nombre} · ${AMB[f.ambito] ?? f.ambito}`).join('\n')}`
  },
})

// ---------------------------------------------------------------------------------------------

export const historialOrden = herramienta({
  nombre: 'historial_orden',
  titulo: 'Historial de una orden',
  descripcion:
    'Todo lo que ha pasado en una orden por orden cronológico: fechas, visitas y citas, tareas y cambios de datos, con el «día N» desde la fecha de la orden. ' +
    'Los textos libres (notas, situación…) salen ocultos salvo con incluir_detalles.',
  entrada: z
    .strictObject({ ...refOrden, incluir_detalles: z.boolean().default(false).describe(AVISO_DETALLES) })
    .refine((a) => a.orden_id || a.num_orden, { message: 'Indica orden_id o num_orden' }),
  clase: 'lectura',
  async ejecutar(a, ctx) {
    const o = await buscarOrden(ctx, a)
    const [ag, cambios, ts] = await Promise.all([leer(ctx.datos.listarAgendaOrden(o.id)), leer(ctx.datos.listarHistorial(o.id)), mapaTipos(ctx)])
    const libres = new Set<string>(CAMPOS_LIBRES)
    const cs = cambios.map((c) => ({
      ...c,
      // La hora del cambio, en hora de España aunque el servidor esté en UTC
      momento: aHoraLocalMadrid(c.momento),
      antes: !a.incluir_detalles && c.campo && libres.has(c.campo) && c.antes ? '(oculto)' : c.antes,
      despues: !a.incluir_detalles && c.campo && libres.has(c.campo) && c.despues ? '(oculto)' : c.despues,
    }))
    const entradas = construirHistorial(o, ag.eventos, ag.tareas, cs, ts, ctx.hoy)
    if (!entradas.length) return `La orden ${lineaOrden(o)} aún no tiene historial.`
    const l = entradas.map((e) => {
      const cab = `• ${dma(e.fecha)}${e.hora ? ' ' + e.hora : ''}${e.dia !== null ? ` · día ${e.dia}` : ''}${e.futura ? ' · (futuro)' : ''} · ${e.titulo}`
      return a.incluir_detalles && e.detalle ? `${cab}\n    ${e.detalle}` : cab
    })
    return `Historial de ${lineaOrden(o)}:\n${l.join('\n')}`
  },
})

export const HERRAMIENTAS_LECTURA = [buscarOrdenes, verOrden, plazos, agenda, porProgramarH, huecoVisita, festivosH, historialOrden]
