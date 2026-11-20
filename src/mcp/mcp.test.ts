// Pruebas del servidor MCP para ChatGPT, con datos INVENTADOS (datosPrueba.ts).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nuevoCtx } from './comun'
import { datosPrueba, ID } from './datosPrueba'
import { CAMPOS_EDITABLES } from './escritura'
import { comprobarIdentidad, crearAtender, Limitador } from './http'
import { anotaciones } from './herramienta'
import { aHoraLocalMadrid, diaMadrid } from './reloj'
import { cambiarDestino } from './registro'
import { HERRAMIENTAS } from './servidor'
import { fecha, texto } from './esquemas'
import { recortar } from './formato'

// Vitest corre en Node: se cambia la zona del proceso para simular el servidor de Supabase (UTC)
declare const process: { env: Record<string, string | undefined> }

/** Viernes 20-11-2026, 10:00 en España */
const R = { ahora: () => new Date('2026-11-20T09:00:00Z') }
const reloj = (iso: string) => ({ ahora: () => new Date(iso) })

function h(nombre: string) {
  const x = HERRAMIENTAS.find((t) => t.nombre === nombre)
  if (!x) throw new Error('no existe ' + nombre)
  return x
}
async function llamar(nombre: string, args: Record<string, unknown>, d = datosPrueba(), r = R) {
  const x = h(nombre)
  return x.ejecutar(x.entrada.parse(args) as never, nuevoCtx(d.datos, r))
}

let logs: string[] = []
beforeEach(() => {
  logs = []
  cambiarDestino((l) => logs.push(l))
})
afterEach(() => cambiarDestino((l) => console.log(l)))

// ---------------------------------------------------------------------------------------------
describe('hora de España (el servidor está en UTC)', () => {
  it('de madrugada en España ya es el día siguiente aunque en UTC sea el anterior', () => {
    expect(diaMadrid(new Date('2026-11-19T23:30:00Z'))).toBe('2026-11-20') // invierno, UTC+1
    expect(diaMadrid(new Date('2026-07-19T22:30:00Z'))).toBe('2026-07-20') // verano, UTC+2
    expect(diaMadrid(new Date('2026-07-19T21:30:00Z'))).toBe('2026-07-19')
  })
  it('la hora del historial sale en hora de España', () => {
    expect(aHoraLocalMadrid('2026-11-19T23:30:00+00:00')).toBe('2026-11-20T00:30:00')
    expect(aHoraLocalMadrid('2026-08-01T10:00:00Z')).toBe('2026-08-01T12:00:00')
  })
  it('con el proceso en UTC, «hoy» y la agenda siguen siendo los de España', async () => {
    const antes = process.env.TZ
    process.env.TZ = 'UTC'
    try {
      // Domingo 22-11 a las 23:30 UTC = lunes 23-11 a las 00:30 en España
      const t = await llamar('agenda', {}, datosPrueba(), reloj('2026-11-22T23:30:00Z'))
      expect(t).toContain('lun 23/11/2026 (hoy)')
      expect(t).toContain('Comparecencia')
    } finally {
      process.env.TZ = antes
    }
  })
})

// ---------------------------------------------------------------------------------------------
describe('lista de herramientas', () => {
  it('están todas las pedidas y NINGUNA borra ni ejecuta SQL', () => {
    const nombres = HERRAMIENTAS.map((t) => t.nombre).sort()
    expect(nombres).toEqual(
      [
        'buscar_ordenes', 'ver_orden', 'plazos', 'agenda', 'por_programar', 'hueco_visita', 'festivos', 'historial_orden', 'informe',
        'crear_orden', 'editar_orden', 'cambiar_estado_orden', 'registrar_visita', 'marcar_visita', 'mover_visita', 'crear_tarea', 'completar_tarea',
      ].sort(),
    )
    for (const t of HERRAMIENTAS) expect(t.nombre + t.descripcion.toLowerCase()).not.toMatch(/borrar_|eliminar_|delete|\bsql\b|query/)
  })
  it('las de lectura van marcadas como solo lectura y las de escritura no (ChatGPT pide confirmación)', () => {
    const lectura = ['buscar_ordenes', 'ver_orden', 'plazos', 'agenda', 'por_programar', 'hueco_visita', 'festivos', 'historial_orden', 'informe']
    for (const t of HERRAMIENTAS) {
      const a = anotaciones(t.clase)
      expect(a.readOnlyHint, t.nombre).toBe(lectura.includes(t.nombre))
      expect(a.openWorldHint).toBe(false)
    }
  })
  it('los esquemas son estrictos: un campo desconocido se rechaza', () => {
    for (const t of HERRAMIENTAS) expect(t.entrada.safeParse({ campo_inventado: 1 }).success, t.nombre).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
describe('validación de entradas', () => {
  it('fechas: solo aaaa-mm-dd que existan', () => {
    expect(fecha.safeParse('2026-11-23').success).toBe(true)
    for (const f of ['2026-02-30', '23/11/2026', '2026-1-5', '2026-11-23T10:00', '', '1800-01-01']) expect(fecha.safeParse(f).success, f).toBe(false)
  })
  it('textos: longitud y sin caracteres de control', () => {
    expect(texto(10).safeParse('hola').success).toBe(true)
    expect(texto(10).safeParse('x'.repeat(11)).success).toBe(false)
    expect(texto(10).safeParse('a\u0000b').success).toBe(false)
    expect(texto(10).safeParse('a\nb').success).toBe(false)
    expect(texto(10).safeParse('   ').success).toBe(false)
  })
  it('ids con formato UUID y valores de listas cerradas', () => {
    expect(h('marcar_visita').entrada.safeParse({ visita_id: "1' or 1=1", resultado: 'hecha' }).success).toBe(false)
    expect(h('marcar_visita').entrada.safeParse({ visita_id: ID.v1, resultado: 'quizá' }).success).toBe(false)
    expect(h('cambiar_estado_orden').entrada.safeParse({ orden_id: ID.o1, estado: 'BORRADA' }).success).toBe(false)
    expect(h('plazos').entrada.safeParse({ limite: 100000 }).success).toBe(false)
  })
  it('editar_orden: solo campos de la lista blanca (ni estado, ni id, ni created_by)', () => {
    const e = h('editar_orden').entrada
    for (const c of ['estado', 'id', 'created_by', 'fecha_cierre', 'created_at']) expect(e.safeParse({ orden_id: ID.o1, cambios: { [c]: 'x' } }).success, c).toBe(false)
    expect(e.safeParse({ orden_id: ID.o1, cambios: {} }).success).toBe(false)
    expect(e.safeParse({ orden_id: ID.o1, cambios: { empresa: 'Nueva SL' } }).success).toBe(true)
  })
  it('rango de agenda: como mucho 62 días y «hasta» no antes de «desde»', async () => {
    await expect(llamar('agenda', { desde: '2026-11-20', hasta: '2027-03-01' })).rejects.toThrow(/demasiado largo/)
    await expect(llamar('agenda', { desde: '2026-11-20', hasta: '2026-11-19' })).rejects.toThrow(/anterior/)
  })
})

// ---------------------------------------------------------------------------------------------
describe('lectura: no escribe nada y da lo justo', () => {
  const casos: [string, Record<string, unknown>][] = [
    ['buscar_ordenes', {}],
    ['buscar_ordenes', { texto: 'bodegas', estado: 'TODAS' }],
    ['ver_orden', { orden_id: ID.o1 }],
    ['ver_orden', { num_orden: 'prueba/002', incluir_detalles: true }],
    ['plazos', {}],
    ['agenda', { desde: '2026-11-16', hasta: '2026-11-29' }],
    ['por_programar', {}],
    ['hueco_visita', { cuantos: 3 }],
    ['festivos', { anio: 2026 }],
    ['historial_orden', { orden_id: ID.o1 }],
    ['informe', { tipo: 'semanal' }],
    ['informe', { tipo: 'vencidos' }],
    ['informe', { tipo: 'mensual', mes: '2026-11' }],
    ['informe', { tipo: 'estadisticas', anio: 2026 }],
  ]
  it.each(casos)('%s %j no escribe', async (nombre, args) => {
    const d = datosPrueba()
    const t = await llamar(nombre, args, d)
    expect(t.length).toBeGreaterThan(10)
    expect(d.escrituras).toEqual([])
  })
  it('sin pedirlo, no salen notas, direcciones, teléfonos ni textos libres', async () => {
    const d = datosPrueba()
    const textos = await Promise.all([
      llamar('ver_orden', { orden_id: ID.o1 }, d),
      llamar('agenda', { desde: '2026-11-20', hasta: '2026-11-29' }, d),
      llamar('historial_orden', { orden_id: ID.o1 }, d),
      llamar('informe', { tipo: 'semanal' }, d),
    ])
    for (const t of textos) expect(t).not.toMatch(/SECRET|CALLE INVENTADA|600000000/)
  })
  it('pidiéndolo expresamente (incluir_detalles), sí salen', async () => {
    const t = await llamar('ver_orden', { orden_id: ID.o1, incluir_detalles: true })
    expect(t).toContain('OBJETO SECRETO DE PRUEBA')
    expect(t).toContain('CALLE INVENTADA 1')
    expect(t).toContain('600000000')
    expect(t).toContain('NOTA SECRETA')
  })
  it('buscar_ordenes: sin tildes ni mayúsculas, activas por defecto, por plazo más cercano', async () => {
    const t = await llamar('buscar_ordenes', {})
    expect(t).not.toContain('Cerrada SA')
    expect(t.indexOf('PRUEBA/002')).toBeLessThan(t.indexOf('PRUEBA/001')) // la vencida primero
    expect(await llamar('buscar_ordenes', { texto: 'TALLERES inventados' })).toContain('PRUEBA/001')
  })
  it('plazos: los vencidos y los próximos 30 días, con días que quedan', async () => {
    const t = await llamar('plazos', {})
    expect(t).toContain('Vencidos')
    expect(t).toMatch(/9 meses: 01\/12\/2026 \(en 11 días\)/)
  })
  it('hueco_visita: domingo o lunes, sin festivo y con sitio', async () => {
    const t = await llamar('hueco_visita', { cuantos: 2 })
    expect(t).toContain('dom 22/11/2026')
    expect(t).toContain('lun 23/11/2026')
  })
  it('historial: la hora del cambio en hora de España y los textos libres ocultos', async () => {
    const t = await llamar('historial_orden', { orden_id: ID.o1 })
    expect(t).toContain('20/11/2026 00:30')
    expect(t).toContain('(oculto)')
    expect(t).toContain('Documentación: Aún nada → Solicitada')
  })
  it('informe semanal: domingo y lunes que vienen y oficina', async () => {
    const t = await llamar('informe', { tipo: 'semanal' })
    expect(t).toContain('DOMINGO 22/11/2026')
    expect(t).toContain('LUNES 23/11/2026')
    expect(t).toContain('Subir documentación') // tarea para la oficina
  })
  it('estadísticas: recibidas, cerradas, días para cerrar, visitas hechas y fallidas', async () => {
    const t = await llamar('informe', { tipo: 'estadisticas', anio: 2026 })
    expect(t).toMatch(/noviembre de 2026: recibidas 0 · cerradas 1 · días medios para cerrar 301/)
    expect(t).toMatch(/marzo de 2026: .*visitas hechas 1/)
    expect(t).toMatch(/abril de 2026: .*fallidas 1/)
  })
})

// ---------------------------------------------------------------------------------------------
describe('escritura: solo lo pedido y solo campos permitidos', () => {
  it('crear_orden: crea una y no repite nº de orden', async () => {
    const d = datosPrueba()
    const t = await llamar('crear_orden', { num_orden: 'PRUEBA/009', empresa: 'Nueva Inventada SL' }, d)
    expect(t).toContain('Orden creada: PRUEBA/009')
    expect(d.escrituras[0].datos.fecha_orden).toBe('2026-11-20')
    await expect(llamar('crear_orden', { num_orden: 'prueba/001', empresa: 'X' }, d)).rejects.toThrow(/Ya existe/)
  })
  it('editar_orden: solo escribe campos de la lista blanca y dice qué cambió', async () => {
    const d = datosPrueba()
    const t = await llamar('editar_orden', { orden_id: ID.o1, cambios: { empresa: 'Otro Nombre SL', doc_subida: 'SI' } }, d)
    expect(t).toContain('Empresa: TALLERES INVENTADOS SL → Otro Nombre SL')
    expect(d.escrituras).toHaveLength(1)
    for (const c of d.escrituras[0].campos) expect(CAMPOS_EDITABLES as readonly string[]).toContain(c)
  })
  it('cambiar_estado_orden: al finalizar pone la fecha de cierre de HOY en España', async () => {
    const d = datosPrueba()
    await llamar('cambiar_estado_orden', { orden_id: ID.o1, estado: 'FINALIZADA' }, d, reloj('2026-11-19T23:30:00Z'))
    expect(d.escrituras[0].datos).toEqual({ estado: 'FINALIZADA', fecha_cierre: '2026-11-20' })
  })
  it('registrar_visita: enlazada a la orden y avisa si no es día de visita', async () => {
    const d = datosPrueba()
    const t = await llamar('registrar_visita', { num_orden: 'PRUEBA/001', fecha: '2026-11-25', hora_inicio: '10:00' }, d)
    expect(t).toContain('no es domingo ni lunes')
    expect(d.escrituras[0].datos).toMatchObject({ orden_id: ID.o1, fecha: '2026-11-25', hora_inicio: '10:00', todo_el_dia: false, tipo: 'visita' })
  })
  it('marcar_visita SIN actualizar_orden: marca la visita y NO toca la orden', async () => {
    const d = datosPrueba()
    const t = await llamar('marcar_visita', { visita_id: ID.v1, resultado: 'hecha', detalles: 'Todo correcto' }, d)
    expect(d.escrituras.map((e) => e.metodo)).toEqual(['actualizarEvento'])
    expect(d.escrituras[0].datos).toEqual({ estado: 'hecha', notas: 'NOTA SECRETA\nTodo correcto' })
    expect(t).toContain('NO se ha cambiado')
    expect(t).not.toContain('NOTA SECRETA')
  })
  it('marcar_visita CON actualizar_orden: aplica la secuencia del Excel', async () => {
    const d = datosPrueba()
    const t = await llamar('marcar_visita', { visita_id: ID.v1, resultado: 'fallida', actualizar_orden: true }, d)
    const o = d.escrituras.find((e) => e.metodo === 'actualizarOrden')!
    expect(o.datos).toEqual({ fecha_ultima_actuacion: '2026-11-22', estado_visita: '1º FALLIDA' })
    expect(t).toContain('actualizada')
  })
  it('mover_visita: cambia el día y conserva la hora; no mueve series ni visitas ya hechas', async () => {
    const d = datosPrueba()
    await llamar('mover_visita', { visita_id: ID.v1, nueva_fecha: '2026-11-29' }, d)
    expect(d.escrituras[0].datos).toMatchObject({ fecha: '2026-11-29', hora_inicio: '10:00', todo_el_dia: false })
    await expect(llamar('mover_visita', { visita_id: ID.serie, nueva_fecha: '2026-11-29' }, d)).rejects.toThrow(/se repite/)
    await llamar('marcar_visita', { visita_id: ID.v2, resultado: 'hecha' }, d)
    await expect(llamar('mover_visita', { visita_id: ID.v2, nueva_fecha: '2026-11-29' }, d)).rejects.toThrow(/ya está hecha/)
  })
  it('crear_tarea y completar_tarea', async () => {
    const d = datosPrueba()
    expect(await llamar('crear_tarea', { titulo: 'Revisar acta', para_oficina: true }, d)).toContain('para la oficina')
    expect(await llamar('completar_tarea', { tarea_id: ID.t1 }, d)).toContain('Hecha: «Llamar a la empresa» (20/11/2026)')
    expect(d.escrituras[d.escrituras.length - 1].datos).toEqual({ hecha: true, hecha_el: '2026-11-20' })
  })
})

// ---------------------------------------------------------------------------------------------
describe('por HTTP (protocolo MCP de verdad)', () => {
  const pedir = (cuerpo: unknown, d = datosPrueba()) => {
    const atender = crearAtender({ reloj: R, limitador: new Limitador(1000, 10000) })
    const req = new Request('https://ejemplo.invalid/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(cuerpo),
    })
    return atender(req, { usuario: 'u-prueba', clienteId: 'c-prueba', datos: d.datos })
  }
  const leerRpc = async (r: Response) => {
    const t = await r.text()
    const linea = t.split('\n').find((l) => l.startsWith('data: '))
    return JSON.parse(linea ? linea.slice(6) : t)
  }

  it('lista las herramientas con sus anotaciones y esquemas', async () => {
    const r = await leerRpc(await pedir({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }))
    const tools = r.result.tools as { name: string; annotations: { readOnlyHint: boolean }; inputSchema: { type: string } }[]
    expect(tools).toHaveLength(17)
    expect(tools.find((t) => t.name === 'ver_orden')!.annotations.readOnlyHint).toBe(true)
    expect(tools.find((t) => t.name === 'editar_orden')!.annotations.readOnlyHint).toBe(false)
    for (const t of tools) expect(t.inputSchema.type).toBe('object')
  })
  it('llama a una herramienta y devuelve texto', async () => {
    const r = await leerRpc(await pedir({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'buscar_ordenes', arguments: { texto: 'bodegas' } } }))
    expect(r.result.content[0].text).toContain('PRUEBA/002')
    expect(r.result.isError).toBeFalsy()
  })
  it('una entrada mala se rechaza sin tocar nada', async () => {
    const d = datosPrueba()
    const r = await leerRpc(await pedir({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'cambiar_estado_orden', arguments: { orden_id: ID.o1, estado: 'X' } } }, d))
    expect(r.result?.isError ?? !!r.error).toBe(true)
    expect(d.escrituras).toEqual([])
  })
  it('un error interno no enseña detalles (ni tablas, ni direcciones IP) y el registro no lleva datos', async () => {
    const d = datosPrueba({ fallar: true })
    const r = await leerRpc(await pedir({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'buscar_ordenes', arguments: { texto: 'TALLERES' } } }, d))
    expect(r.result.isError).toBe(true)
    expect(JSON.stringify(r)).not.toMatch(/relation|secreta|10\.0\.0\.1/)
    expect(logs.join('\n')).not.toMatch(/TALLERES|u-prueba|relation/)
    expect(logs.join('\n')).toContain('"herramienta":"buscar_ordenes"')
  })
  it('una herramienta que no existe (p. ej. borrar) no se puede llamar', async () => {
    const d = datosPrueba()
    const r = await leerRpc(await pedir({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'borrar_orden', arguments: { orden_id: ID.o1 } } }, d))
    expect(r.error ?? r.result?.isError).toBeTruthy()
    expect(d.escrituras).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
describe('quién puede entrar', () => {
  const req = new Request('https://ejemplo.invalid/mcp', { method: 'POST', headers: { authorization: 'Bearer token-de-prueba' } })
  const authOk = { auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) } } as never
  const authKo = { auth: { getUser: async () => ({ data: { user: null }, error: { message: 'session_not_found' } }) } } as never
  const datos = () => datosPrueba().datos
  const op = { clientesPermitidos: [] as string[] }

  it('una sesión de la web (sin client_id) NO entra', async () => {
    const r = await comprobarIdentidad(req, authOk, { sub: 'u1', role: 'authenticated' }, datos, op)
    expect((r as Response).status).toBe(403)
  })
  it('sin usuario o con un rol que no es authenticated, no entra', async () => {
    expect(((await comprobarIdentidad(req, authOk, null, datos, op)) as Response).status).toBe(401)
    expect(((await comprobarIdentidad(req, authOk, { sub: 'u1', role: 'anon', client_id: 'c' }, datos, op)) as Response).status).toBe(401)
  })
  it('con la conexión OAuth viva, entra', async () => {
    const r = await comprobarIdentidad(req, authOk, { sub: 'u1', role: 'authenticated', client_id: 'chatgpt' }, datos, op)
    expect(r).toMatchObject({ usuario: 'u1', clienteId: 'chatgpt' })
  })
  it('si el permiso se ha revocado (sesión borrada), no entra', async () => {
    const r = await comprobarIdentidad(req, authKo, { sub: 'u1', role: 'authenticated', client_id: 'chatgpt' }, datos, op)
    expect((r as Response).status).toBe(401)
  })
  it('si se fija la lista de asistentes, otro no entra', async () => {
    const r = await comprobarIdentidad(req, authOk, { sub: 'u1', role: 'authenticated', client_id: 'otro' }, datos, { clientesPermitidos: ['chatgpt'] })
    expect((r as Response).status).toBe(403)
  })
  it('límite de peticiones por minuto y por hora', () => {
    let t = 0
    const l = new Limitador(3, 5, () => t)
    expect([l.esperar('u'), l.esperar('u'), l.esperar('u')]).toEqual([0, 0, 0])
    expect(l.esperar('u')).toBeGreaterThan(0)
    expect(l.esperar('otra')).toBe(0)
    t = 61_000
    expect([l.esperar('u'), l.esperar('u')]).toEqual([0, 0])
    t = 122_000
    expect(l.esperar('u')).toBeGreaterThan(0) // 5 en la última hora
  })
  it('respuestas demasiado largas se recortan con aviso', () => {
    const r = recortar(('línea\n').repeat(10_000), 1000)
    expect(r.length).toBeLessThanOrEqual(1100)
    expect(r).toContain('recortada')
  })
})
