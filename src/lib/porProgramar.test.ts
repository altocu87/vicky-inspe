import { describe, expect, it } from 'vitest'
import { leerEvento } from './eventos'
import { ORDEN_VACIA, type Orden } from './ordenes'
import { contextoBase } from './plazos/motor'
import { esVisitaFuturaOSerie, ordenesConVisitaFutura, porProgramar, proximasVisitas } from './porProgramar'
import { tareaNueva, type Tarea } from './tareas'

const HOY = '2026-11-19'
const ctx = contextoBase(HOY)
let n = 0
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const orden = (p: Partial<Orden>): Orden => ({ ...ORDEN_VACIA, num_orden: String(n), empresa: 'X', ...p, id: p.id ?? id(), created_at: '', updated_at: '' })
const tarea = (p: Partial<Tarea>): Tarea => ({ ...tareaNueva({ titulo: 't', ...p }), id: id() })
const visita = (orden_id: string, fecha: string, estado = 'pendiente') => leerEvento({ id: id(), titulo: 'v', tipo: 'visita', fecha, estado, orden_id })!

describe('Por programar', () => {
  // 1.ª actuación hace 9 meses menos 10 días → vence en 10 días
  const urgente = orden({ fecha_primera_actuacion: '2026-03-01' }) // lim9 = 2026-12-01 → 12 días
  const vencida = orden({ fecha_primera_actuacion: '2026-01-01' }) // vencida
  const lejana = orden({ fecha_primera_actuacion: '2026-10-01' })
  const fin = orden({ fecha_primera_actuacion: '2026-01-01', estado: 'FINALIZADA' })
  const conVisita = orden({ fecha_primera_actuacion: '2026-03-02' })
  const eventos = [visita(conVisita.id, '2026-11-22'), visita(urgente.id, '2026-11-01'), visita(lejana.id, '2026-11-29', 'cancelada')]

  it('órdenes urgentes sin visita futura, la más urgente primero; luego tareas por prioridad', () => {
    const futuras = ordenesConVisitaFutura(eventos, HOY)
    expect([...futuras]).toEqual([conVisita.id])
    const ts = [tarea({ prioridad: 'baja', titulo: 'b' }), tarea({ prioridad: 'alta', titulo: 'a' }), tarea({ vence: '2026-11-20' }), tarea({ oficina: true }), tarea({ hecha: true })]
    const items = porProgramar([lejana, urgente, fin, conVisita, vencida], ts, futuras, ctx)
    expect(items.map((i) => (i.tipo === 'orden' ? i.orden.id : i.tarea.titulo))).toEqual([vencida.id, urgente.id, 'a', 'b'])
  })
  it('próxima visita de cada orden', () => {
    const m = proximasVisitas([...eventos, visita(conVisita.id, '2026-11-23'), visita(conVisita.id, '2026-11-20', 'hecha')], HOY)
    expect(m.get(conVisita.id)!.fecha).toBe('2026-11-22')
    expect(m.has(urgente.id)).toBe(false)
  })
})

describe('Visitas que se repiten (series)', () => {
  const o = orden({ fecha_primera_actuacion: '2026-03-01' })
  // Serie semanal que empezó ANTES de hoy (jueves 5-nov-2026); hoy es jueves 19-nov
  const serie = leerEvento({ id: id(), titulo: 'v', tipo: 'visita', fecha: '2026-11-05', estado: 'pendiente', orden_id: o.id, rrule: 'FREQ=WEEKLY' })!
  it('una serie empezada antes de hoy cuenta como próxima visita (su siguiente día)', () => {
    expect(serie.rrule).toBe('FREQ=WEEKLY')
    const m = proximasVisitas([serie], HOY)
    expect(m.get(o.id)?.fecha).toBe('2026-11-19')
    expect(m.get(o.id)?.id).toBe(serie.id)
    expect(ordenesConVisitaFutura([serie], HOY).has(o.id)).toBe(true)
    expect(porProgramar([o], [], ordenesConVisitaFutura([serie], HOY), ctx)).toEqual([])
  })
  it('salta los días quitados y los sustituidos por una excepción cancelada', () => {
    const conQuitado = { ...serie, exdates: ['2026-11-19'] }
    const cancelada = leerEvento({ id: id(), titulo: 'v', tipo: 'visita', fecha: '2026-11-26', estado: 'cancelada', orden_id: o.id, serie_id: serie.id, ocurrencia_original: '2026-11-26' })!
    expect(proximasVisitas([conQuitado, cancelada], HOY).get(o.id)?.fecha).toBe('2026-12-03')
  })
  it('una serie que ya terminó no cuenta', () => {
    const acabada = { ...serie, rrule: 'FREQ=WEEKLY;COUNT=2' }
    expect(proximasVisitas([acabada], HOY).has(o.id)).toBe(false)
  })
  it('qué se carga: series empezadas antes y excepciones desde hoy', () => {
    expect(esVisitaFuturaOSerie(serie, HOY)).toBe(true)
    expect(esVisitaFuturaOSerie(visita(o.id, '2026-11-01'), HOY)).toBe(false)
    expect(esVisitaFuturaOSerie(visita(o.id, '2026-11-20'), HOY)).toBe(true)
  })
})
