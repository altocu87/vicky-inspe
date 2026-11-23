import { describe, expect, it } from 'vitest'
import { deUnoEnUno, enBloque, restaurarEventos, restaurarTareas } from './restaurar'
import type { Evento, EventoInput } from './eventos'
import type { Tarea, TareaInput } from './tareas'

const ev = (id: string, p: Partial<Evento> = {}) => ({ id, created_at: 'x', updated_at: 'x', serie_id: null, rrule: null, fecha: '2026-11-10', ...p }) as Evento

describe('deshacer un borrado', () => {
  it('recrea la serie y sus excepciones apuntando a la serie nueva (en dos peticiones)', async () => {
    const peticiones: EventoInput[][] = []
    let n = 0
    const crear = enBloque(async (l: EventoInput[]) => {
      peticiones.push(l)
      return { data: l.map((e) => ({ ...e, id: 'nuevo' + ++n }) as Evento), error: null }
    })
    const fallos = await restaurarEventos([ev('exc', { serie_id: 'serie' }), ev('serie', { rrule: 'FREQ=WEEKLY' })], crear, { orden_id: 'o2' })
    expect(fallos).toBe(0)
    expect(peticiones).toHaveLength(2)
    expect(peticiones[0][0].rrule).toBe('FREQ=WEEKLY')
    expect(peticiones[1][0].serie_id).toBe('nuevo1')
    expect(peticiones.flat().every((c) => c.orden_id === 'o2' && !('id' in c))).toBe(true)
  })
  it('cuenta los fallos: si la serie falla, sus excepciones también', async () => {
    const crear = deUnoEnUno(async (e: EventoInput) => (e.rrule ? null : ({ ...e, id: 'n' } as Evento)))
    expect(await restaurarEventos([ev('serie', { rrule: 'FREQ=DAILY' }), ev('exc', { serie_id: 'serie' }), ev('suelta')], crear)).toBe(2)
  })
  it('una inserción masiva que falla cuenta todo el grupo y avisa', async () => {
    const avisos: string[] = []
    const crear = enBloque<EventoInput, Evento>(async () => ({ data: null, error: 'red' }), (e) => avisos.push(e))
    expect(await restaurarEventos([ev('a'), ev('b')], crear)).toBe(2)
    expect(avisos).toEqual(['red'])
  })
  it('una excepción cuya serie sigue existiendo se crea tal cual', async () => {
    const creados: EventoInput[] = []
    await restaurarEventos([ev('exc', { serie_id: 'otra' })], deUnoEnUno(async (e: EventoInput) => (creados.push(e), { ...e, id: 'n' } as Evento)))
    expect(creados[0].serie_id).toBe('otra')
  })
  it('las tareas que fallan (o lanzan error) se cuentan', async () => {
    let i = 0
    const crear = deUnoEnUno(async (t: TareaInput) => {
      void t
      i++
      if (i === 1) throw new Error('red')
      return i === 2 ? null : ({ id: 'n' } as Tarea)
    })
    expect(await restaurarTareas([{ id: 'a' }, { id: 'b' }, { id: 'c' }] as Tarea[], crear)).toBe(2)
    expect(await restaurarTareas([], crear)).toBe(0)
  })
})
