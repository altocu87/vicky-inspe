import { describe, expect, it } from 'vitest'
import { restaurarEventos, restaurarTareas } from './restaurar'
import type { Evento, EventoInput } from './eventos'
import type { Tarea } from './tareas'

const ev = (id: string, p: Partial<Evento> = {}) => ({ id, created_at: 'x', updated_at: 'x', serie_id: null, rrule: null, fecha: '2026-11-10', ...p }) as Evento

describe('deshacer un borrado', () => {
  it('recrea la serie y sus excepciones apuntando a la serie nueva', async () => {
    const creados: EventoInput[] = []
    let n = 0
    const crear = async (e: EventoInput) => {
      creados.push(e)
      return { ...e, id: 'nuevo' + ++n } as Evento
    }
    const fallos = await restaurarEventos([ev('exc', { serie_id: 'serie' }), ev('serie', { rrule: 'FREQ=WEEKLY' })], crear, { orden_id: 'o2' })
    expect(fallos).toBe(0)
    expect(creados[0].rrule).toBe('FREQ=WEEKLY')
    expect(creados[1].serie_id).toBe('nuevo1')
    expect(creados.every((c) => c.orden_id === 'o2' && !('id' in c))).toBe(true)
  })
  it('cuenta los fallos: si la serie falla, sus excepciones también', async () => {
    const crear = async (e: EventoInput) => (e.rrule ? null : ({ ...e, id: 'n' } as Evento))
    expect(await restaurarEventos([ev('serie', { rrule: 'FREQ=DAILY' }), ev('exc', { serie_id: 'serie' }), ev('suelta')], crear)).toBe(2)
  })
  it('una excepción cuya serie sigue existiendo se crea tal cual', async () => {
    const creados: EventoInput[] = []
    await restaurarEventos([ev('exc', { serie_id: 'otra' })], async (e) => (creados.push(e), { ...e, id: 'n' } as Evento))
    expect(creados[0].serie_id).toBe('otra')
  })
  it('las tareas que fallan (o lanzan error) se cuentan', async () => {
    let i = 0
    const crear = async () => {
      i++
      if (i === 1) throw new Error('red')
      return i === 2 ? null : ({ id: 'n' } as Tarea)
    }
    expect(await restaurarTareas([{ id: 'a' }, { id: 'b' }, { id: 'c' }] as Tarea[], crear)).toBe(2)
  })
})
