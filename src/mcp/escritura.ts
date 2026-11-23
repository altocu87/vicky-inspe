// Herramientas de ESCRITURA. No van marcadas como «solo lectura»: ChatGPT pide confirmación antes de cada una.
// NO hay ninguna herramienta de borrar. Solo se escriben campos de una lista blanca.
// Los cambios en las órdenes quedan en su historial (lo escribe la base de datos, no este servidor).
import { z } from 'zod'
import { addDias, diasEntre } from '../lib/fechas'
import { mapaFestivos } from '../lib/habiles'
import { ESTADOS_VISITA, MAX_TEXTO, ORDEN_VACIA, label, type Orden } from '../lib/ordenes'
import { NOMBRE_CAMPO_HIST } from '../lib/historial'
import { eventoNuevo, type Evento, type EventoInput } from '../lib/eventos'
import { cambiosAlHacer, tareaNueva } from '../lib/tareas'
import { esDiaVisita } from '../lib/semana'
import { hayPropuesta, propuestaAlMarcar } from '../lib/visitaEstado'
import { ErrorHerramienta, buscarOrden, festivos, leer, normal, ordenes, tipos, type Ctx } from './comun'
import { estadoDocum, estadoOrden, fecha, hora, numOrden, prioridad, repeticion, siNo, telefono, texto, textoLargo, tipoCita, uuid } from './esquemas'
import { diaYFecha, dma, lineaEvento, lineaOrden, lineaTarea } from './formato'
import { herramienta } from './herramienta'
import { refOrden } from './lectura'

const conOrden = <T extends { orden_id?: string; num_orden?: string }>(a: T) => !!(a.orden_id || a.num_orden)

/** Aviso si un día no es domingo/lunes, es festivo o ya ha pasado (no impide nada: solo informa) */
async function avisosDia(ctx: Ctx, dia: string, esVisita: boolean): Promise<string[]> {
  const av: string[] = []
  const f = mapaFestivos(await festivos(ctx)).get(dia)
  if (f) av.push(`Ojo: el ${dma(dia)} es festivo (${f.nombre}).`)
  if (esVisita && !esDiaVisita(dia)) av.push(`Ojo: el ${diaYFecha(dia)} no es domingo ni lunes (los días de visita).`)
  if (dia < ctx.hoy) av.push(`Ojo: el ${dma(dia)} ya ha pasado.`)
  return av
}

/** Describe lo que ha cambiado: «Empresa: A → B» */
function cambiosTexto(antes: Orden, despues: Orden, campos: readonly string[]): string[] {
  const r = antes as unknown as Record<string, string | null>
  const d = despues as unknown as Record<string, string | null>
  return campos.filter((c) => (r[c] ?? null) !== (d[c] ?? null)).map((c) => `${NOMBRE_CAMPO_HIST[c] ?? c}: ${valor(c, r[c])} → ${valor(c, d[c])}`)
}
const valor = (c: string, v: string | null) => (v === null || v === '' ? '—' : c.startsWith('fecha_') ? dma(v) : label(v))

async function evento(ctx: Ctx, id: string): Promise<Evento> {
  const e = await leer(ctx.datos.obtenerEvento(id))
  if (!e) throw new ErrorHerramienta('No encuentro esa visita o cita. Búscala con agenda o ver_orden.')
  if (e.rrule) throw new ErrorHerramienta('Es una cita que se repite. Para cambiar una sola repetición, hazlo desde la app.')
  return e
}

// ---------------------------------------------------------------------------------------------

export const crearOrden = herramienta({
  nombre: 'crear_orden',
  titulo: 'Dar de alta una orden',
  descripcion: 'Da de alta una orden nueva (estado EN CURSO salvo que se diga otro). Antes de llamarla, confirma con la usuaria el nº de orden y la empresa.',
  entrada: z.strictObject({
    num_orden: numOrden,
    empresa: texto(MAX_TEXTO.empresa),
    fecha_orden: fecha.optional(),
    fecha_primera_actuacion: fecha.optional(),
    estado: estadoOrden.default('EN CURSO'),
    objeto: texto(MAX_TEXTO.objeto).optional().describe('Solo si la usuaria lo dicta'),
  }),
  clase: 'alta',
  async ejecutar(a, ctx) {
    const lista = await ordenes(ctx)
    const repetida = lista.find((o) => normal(o.num_orden) === normal(a.num_orden))
    if (repetida) throw new ErrorHerramienta(`Ya existe la orden ${lineaOrden(repetida)} (id: ${repetida.id}). No se ha creado otra.`)
    const payload: Partial<Orden> = {
      ...ORDEN_VACIA,
      num_orden: a.num_orden,
      empresa: a.empresa,
      estado: a.estado,
      fecha_orden: a.fecha_orden ?? ctx.hoy,
      fecha_primera_actuacion: a.fecha_primera_actuacion ?? null,
      objeto: a.objeto ?? null,
      fecha_cierre: a.estado === 'FINALIZADA' ? ctx.hoy : null,
    }
    const o = await leer(ctx.datos.crearOrden(payload))
    ctx.cache.delete('ordenes')
    return `Orden creada: ${lineaOrden(o)} · fecha de la orden ${dma(o.fecha_orden)} · id: ${o.id}`
  },
})

// ---------------------------------------------------------------------------------------------

/** Campos que se pueden cambiar con editar_orden (lista blanca). El estado va aparte; nunca id, fechas de alta ni de cierre. */
export const CAMPOS_EDITABLES = [
  'num_orden',
  'empresa',
  'fecha_orden',
  'fecha_primera_actuacion',
  'fecha_ultima_actuacion',
  'objeto',
  'estado_docum',
  'estado_visita',
  'situacion_general',
  'tareas_pendientes',
  'comparecencia_subida',
  'doc_subida',
  'claves',
] as const

export const editarOrden = herramienta({
  nombre: 'editar_orden',
  titulo: 'Cambiar datos de una orden',
  descripcion:
    'Cambia uno o varios datos de una orden. Solo estos campos: ' +
    CAMPOS_EDITABLES.join(', ') +
    '. Para el estado usa cambiar_estado_orden. Pon null para vaciar un dato. Confirma antes con la usuaria qué cambia.',
  entrada: z
    .strictObject({
      ...refOrden,
      cambios: z
        .strictObject({
          num_orden: numOrden.optional(),
          empresa: texto(MAX_TEXTO.empresa).optional(),
          fecha_orden: fecha.nullable().optional(),
          fecha_primera_actuacion: fecha.nullable().optional(),
          fecha_ultima_actuacion: fecha.nullable().optional(),
          objeto: texto(MAX_TEXTO.objeto).nullable().optional(),
          estado_docum: estadoDocum.optional(),
          estado_visita: z.enum(ESTADOS_VISITA).optional(),
          situacion_general: textoLargo(MAX_TEXTO.situacion_general).nullable().optional(),
          tareas_pendientes: textoLargo(MAX_TEXTO.tareas_pendientes).nullable().optional(),
          comparecencia_subida: siNo.nullable().optional(),
          doc_subida: siNo.nullable().optional(),
          claves: siNo.nullable().optional(),
        })
        .refine((c) => Object.keys(c).length > 0, { message: 'Indica al menos un dato que cambiar' }),
    })
    .refine(conOrden, { message: 'Indica orden_id o num_orden' }),
  clase: 'cambio',
  async ejecutar(a, ctx) {
    const o = await buscarOrden(ctx, a)
    // Lista blanca (por si acaso, además del esquema estricto)
    const cambios = Object.fromEntries(Object.entries(a.cambios).filter(([k, v]) => (CAMPOS_EDITABLES as readonly string[]).includes(k) && v !== undefined)) as Partial<Orden>
    if (cambios.num_orden && normal(cambios.num_orden) !== normal(o.num_orden)) {
      const otra = (await ordenes(ctx)).find((x) => x.id !== o.id && normal(x.num_orden) === normal(cambios.num_orden!))
      if (otra) throw new ErrorHerramienta(`Ya existe otra orden con el nº ${cambios.num_orden}.`)
    }
    const nueva = await leer(ctx.datos.actualizarOrden(o.id, cambios))
    ctx.cache.delete('ordenes')
    const dif = cambiosTexto(o, nueva, CAMPOS_EDITABLES)
    return dif.length ? `Orden ${lineaOrden(nueva)} actualizada:\n${dif.map((d) => '• ' + d).join('\n')}` : `No había nada que cambiar en ${lineaOrden(nueva)}.`
  },
})

// ---------------------------------------------------------------------------------------------

export const cambiarEstadoOrden = herramienta({
  nombre: 'cambiar_estado_orden',
  titulo: 'Cambiar el estado de una orden',
  descripcion: 'Cambia el estado de una orden: EN CURSO, PTE ENTREGA, DEVUELTA o FINALIZADA. Al finalizar se apunta hoy como fecha de cierre; al reabrir se quita.',
  entrada: z.strictObject({ ...refOrden, estado: estadoOrden }).refine(conOrden, { message: 'Indica orden_id o num_orden' }),
  clase: 'cambio',
  async ejecutar(a, ctx) {
    const o = await buscarOrden(ctx, a)
    if (o.estado === a.estado) return `La orden ${lineaOrden(o)} ya estaba en ese estado.`
    // La fecha de cierre se pone con el «hoy» de España (la base de datos usaría el de UTC)
    const cambios: Partial<Orden> = { estado: a.estado, fecha_cierre: a.estado === 'FINALIZADA' ? ctx.hoy : null }
    const n = await leer(ctx.datos.actualizarOrden(o.id, cambios))
    ctx.cache.delete('ordenes')
    return `Orden ${n.num_orden} · ${n.empresa}: ${label(o.estado)} → ${label(n.estado)}${n.estado === 'FINALIZADA' ? ` (cerrada el ${dma(n.fecha_cierre)})` : ''}.`
  },
})

// ---------------------------------------------------------------------------------------------

export const registrarVisita = herramienta({
  nombre: 'registrar_visita',
  titulo: 'Registrar una visita o cita',
  descripcion:
    'Apunta una visita (o una cita de otro tipo, p. ej. comparecencia) en el calendario, normalmente enlazada a una orden. ' +
    'Sin horas, es de todo el día. Avisa si el día es festivo, no es domingo/lunes o ya pasó. Usa hueco_visita para proponer un día libre.',
  entrada: z.strictObject({
    ...refOrden,
    fecha,
    hora_inicio: hora.optional(),
    hora_fin: hora.optional(),
    tipo: tipoCita.default('visita'),
    titulo: texto(200).optional(),
    direccion: texto(300).optional(),
    telefono: telefono.optional(),
    detalles: textoLargo(4000).optional(),
  }),
  clase: 'alta',
  async ejecutar(a, ctx) {
    if (a.hora_fin && !a.hora_inicio) throw new ErrorHerramienta('Si pones hora de fin, pon también la de inicio.')
    if (a.hora_fin && a.hora_inicio && a.hora_fin <= a.hora_inicio) throw new ErrorHerramienta('La hora de fin debe ser posterior a la de inicio.')
    const o = conOrden(a) ? await buscarOrden(ctx, a) : undefined
    const ts = await tipos(ctx)
    const t = ts.find((x) => x.id === a.tipo && x.activo)
    if (!t) throw new ErrorHerramienta(`Tipo de cita no válido. Tipos: ${ts.filter((x) => x.activo).map((x) => x.id).join(', ')}.`)
    const nuevo: EventoInput = eventoNuevo({
      fecha: a.fecha,
      tipo: t.id,
      titulo: a.titulo ?? t.nombre,
      orden_id: o?.id ?? null,
      todo_el_dia: !a.hora_inicio,
      hora_inicio: a.hora_inicio ?? null,
      hora_fin: a.hora_fin ?? null,
      ubicacion: a.direccion ?? null,
      telefono: a.telefono ?? null,
      notas: a.detalles ?? null,
    })
    const e = await leer(ctx.datos.crearEvento(nuevo))
    const av = await avisosDia(ctx, e.fecha, t.id === 'visita')
    return [`Apuntada: ${lineaEvento(e, e.fecha, new Map(ts.map((x) => [x.id, x])), o, false)}`, ...av].join('\n')
  },
})

// ---------------------------------------------------------------------------------------------

export const marcarVisita = herramienta({
  nombre: 'marcar_visita',
  titulo: 'Marcar una visita como hecha o fallida',
  descripcion:
    'Marca una visita o cita como hecha o fallida y, si se dan, añade los detalles. ' +
    'La orden (última actuación, 1.ª actuación si falta, estado de la visita) SOLO se actualiza con actualizar_orden = true, ' +
    'y eso SOLO si la usuaria lo dice expresamente; si no, se le explica qué se podría actualizar para que decida.',
  entrada: z.strictObject({
    visita_id: uuid,
    resultado: z.enum(['hecha', 'fallida']),
    detalles: textoLargo(2000).optional(),
    actualizar_orden: z.boolean().default(false).describe('true SOLO si la usuaria pide expresamente actualizar la orden'),
  }),
  clase: 'cambio',
  async ejecutar(a, ctx) {
    const e = await evento(ctx, a.visita_id)
    if (e.estado === 'cancelada') throw new ErrorHerramienta('Esa cita está cancelada.')
    // Los detalles se AÑADEN a los que ya hubiera (no se pierde nada)
    const notas = a.detalles ? (e.notas ? `${e.notas}\n${a.detalles}` : a.detalles).slice(0, 4000) : e.notas
    const hecha = await leer(ctx.datos.actualizarEvento(e.id, { estado: a.resultado, notas }))
    const ts = new Map((await tipos(ctx)).map((x) => [x.id, x]))
    const o = hecha.orden_id ? (await ordenes(ctx)).find((x) => x.id === hecha.orden_id) : undefined
    const l = [`Marcada como ${a.resultado}: ${lineaEvento(hecha, hecha.fecha, ts, o, false)}${a.detalles ? ' (detalles añadidos)' : ''}`]
    if (!o) return l.join('\n')
    const p = propuestaAlMarcar(o, hecha.fecha, a.resultado, hecha.tipo === 'visita')
    if (!hayPropuesta(p)) {
      l.push('La orden no necesita cambios.')
      return l.join('\n')
    }
    const c: Partial<Orden> = {}
    const txt: string[] = []
    if (p.ultima) {
      c.fecha_ultima_actuacion = p.ultima.despues
      txt.push(`última actuación: ${dma(p.ultima.antes)} → ${dma(p.ultima.despues)}`)
    }
    if (p.primera) {
      c.fecha_primera_actuacion = p.primera.despues
      txt.push(`1.ª actuación: — → ${dma(p.primera.despues)}`)
    }
    if (p.estadoVisita) {
      c.estado_visita = p.estadoVisita.despues
      txt.push(`estado de la visita: ${label(p.estadoVisita.antes)} → ${label(p.estadoVisita.despues)}`)
    }
    if (!a.actualizar_orden) {
      l.push(`La orden ${o.num_orden} NO se ha cambiado. Si la usuaria quiere, se puede actualizar: ${txt.join('; ')}. (Vuelve a llamar con actualizar_orden = true solo si lo pide.)`)
      return l.join('\n')
    }
    await leer(ctx.datos.actualizarOrden(o.id, c))
    ctx.cache.delete('ordenes')
    l.push(`Orden ${o.num_orden} actualizada: ${txt.join('; ')}.`)
    return l.join('\n')
  },
})

// ---------------------------------------------------------------------------------------------

export const moverVisita = herramienta({
  nombre: 'mover_visita',
  titulo: 'Mover una visita a otro día u hora',
  descripcion: 'Cambia el día (y, si se indica, la hora) de una visita o cita pendiente. Si no se dan horas nuevas, conserva las que tenía. todo_el_dia = true quita las horas.',
  entrada: z.strictObject({
    visita_id: uuid,
    nueva_fecha: fecha,
    hora_inicio: hora.optional(),
    hora_fin: hora.optional(),
    todo_el_dia: z.boolean().optional(),
  }),
  clase: 'cambio',
  async ejecutar(a, ctx) {
    const e = await evento(ctx, a.visita_id)
    if (e.estado !== 'pendiente') throw new ErrorHerramienta(`Esa visita ya está ${e.estado}: no se mueve. Si hace falta otra, regístrala nueva.`)
    if (a.hora_fin && a.hora_inicio && a.hora_fin <= a.hora_inicio) throw new ErrorHerramienta('La hora de fin debe ser posterior a la de inicio.')
    const todo = a.todo_el_dia === true ? true : a.hora_inicio ? false : e.todo_el_dia
    const hi = todo ? null : (a.hora_inicio ?? e.hora_inicio)
    let hf = todo ? null : a.hora_inicio ? (a.hora_fin ?? null) : (a.hora_fin ?? e.hora_fin)
    if (hf && hi && hf <= hi) hf = null
    const fin = e.fecha_fin ? addDias(a.nueva_fecha, diasEntre(e.fecha, e.fecha_fin)) : null
    const n = await leer(ctx.datos.actualizarEvento(e.id, { fecha: a.nueva_fecha, fecha_fin: fin, todo_el_dia: todo, hora_inicio: hi, hora_fin: hf }))
    const ts = await tipos(ctx)
    const o = n.orden_id ? (await ordenes(ctx)).find((x) => x.id === n.orden_id) : undefined
    const av = await avisosDia(ctx, n.fecha, n.tipo === 'visita')
    return [`Movida del ${diaYFecha(e.fecha)} al ${lineaEvento(n, n.fecha, new Map(ts.map((x) => [x.id, x])), o, false)}`, ...av].join('\n')
  },
})

// ---------------------------------------------------------------------------------------------

export const crearTarea = herramienta({
  nombre: 'crear_tarea',
  titulo: 'Crear una tarea',
  descripcion: 'Crea una tarea, con o sin fecha, opcionalmente enlazada a una orden. para_oficina = true la deja para el lunes (día de oficina).',
  entrada: z.strictObject({
    ...refOrden,
    titulo: texto(200),
    fecha: fecha.optional(),
    hora: hora.optional(),
    prioridad: prioridad.default('media'),
    para_oficina: z.boolean().default(false),
    repeticion: repeticion.default('no'),
    notas: textoLargo(2000).optional(),
  }),
  clase: 'alta',
  async ejecutar(a, ctx) {
    if (a.hora && !a.fecha) throw new ErrorHerramienta('Para poner hora, pon también la fecha.')
    if (a.repeticion !== 'no' && !a.fecha) throw new ErrorHerramienta('Para que se repita, la tarea necesita fecha.')
    const o = conOrden(a) ? await buscarOrden(ctx, a) : undefined
    const t = await leer(
      ctx.datos.crearTarea(
        tareaNueva({
          titulo: a.titulo,
          vence: a.fecha ?? null,
          hora: a.hora ?? null,
          prioridad: a.prioridad,
          oficina: a.para_oficina,
          repeticion: a.repeticion,
          notas: a.notas ?? null,
          orden_id: o?.id ?? null,
        }),
      ),
    )
    return `Tarea creada: ${lineaTarea(t, o, false)}`
  },
})

// ---------------------------------------------------------------------------------------------

export const completarTarea = herramienta({
  nombre: 'completar_tarea',
  titulo: 'Marcar una tarea como hecha',
  descripcion: 'Marca una tarea como hecha (con la fecha de hoy). Si la tarea se repite, no se cierra: pasa a su siguiente fecha.',
  entrada: z.strictObject({ tarea_id: uuid }),
  clase: 'cambio',
  async ejecutar(a, ctx) {
    const t = await leer(ctx.datos.obtenerTarea(a.tarea_id))
    if (!t) throw new ErrorHerramienta('No encuentro esa tarea. Búscala con agenda o ver_orden.')
    if (t.hecha) return `La tarea «${t.titulo}» ya estaba hecha (${dma(t.hecha_el)}).`
    const n = await leer(ctx.datos.actualizarTarea(t.id, cambiosAlHacer(t, ctx.hoy)))
    return n.hecha ? `Hecha: «${n.titulo}» (${dma(n.hecha_el)}).` : `Hecha: «${n.titulo}». Se repite: la siguiente es el ${diaYFecha(n.vence!)}.`
  },
})

export const HERRAMIENTAS_ESCRITURA = [crearOrden, editarOrden, cambiarEstadoOrden, registrarVisita, marcarVisita, moverVisita, crearTarea, completarTarea]
