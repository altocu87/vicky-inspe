import { describe, expect, it } from 'vitest'
import { eventoEnRango, juntar, Recientes, sustituir, tareaEnRango } from './juntar'
import type { Evento } from './eventos'
import type { Tarea } from './tareas'

type X = { id: string; updated_at?: string; v?: number }
const mapa = (...xs: X[]) => new Map(xs.map((x) => [x.id, x]))

describe('juntar lo que llega del servidor', () => {
  it('añade lo nuevo y no cambia nada si todo es igual', () => {
    const m = mapa({ id: 'a', updated_at: '2026-11-01T10:00:00Z' })
    expect(juntar(m, [{ id: 'a', updated_at: '2026-11-01T10:00:00Z' }])).toBe(m)
    expect(juntar(m, [{ id: 'b', updated_at: '2026-11-01T10:00:00Z' }]).size).toBe(2)
  })
  it('se queda con la versión más reciente (una respuesta lenta no pisa un cambio)', () => {
    const m = mapa({ id: 'a', updated_at: '2026-11-02T10:00:00Z', v: 2 })
    expect(juntar(m, [{ id: 'a', updated_at: '2026-11-01T10:00:00Z', v: 1 }]).get('a')!.v).toBe(2)
    expect(juntar(m, [{ id: 'a', updated_at: '2026-11-03T10:00:00Z', v: 3 }]).get('a')!.v).toBe(3)
  })
  it('ignora lo borrado hace poco', () => {
    expect(juntar(mapa(), [{ id: 'a' }], new Set(['a'])).size).toBe(0)
  })
})

describe('sustituir lo de un rango', () => {
  it('quita lo que estaba en el rango y ya no viene, pero no lo de fuera ni lo tocado aquí', () => {
    const m = mapa({ id: 'dentro', v: 1 }, { id: 'fuera', v: 9 }, { id: 'tocado', v: 1 })
    const r = sustituir(m, [{ id: 'nuevo', v: 1 }], (x) => x.v === 1, undefined, new Set(['tocado']))
    expect([...r.keys()].sort()).toEqual(['fuera', 'nuevo', 'tocado'])
  })
})

describe('condiciones iguales a las consultas', () => {
  const ev = (p: Partial<Evento>) => ({ fecha: '2026-11-10', fecha_fin: null, rrule: null, serie_id: null, ocurrencia_original: null, ...p }) as Evento
  it('eventos del rango', () => {
    const en = eventoEnRango('2026-11-01', '2026-11-30')
    expect(en(ev({}))).toBe(true)
    expect(en(ev({ fecha: '2026-12-02' }))).toBe(false)
    expect(en(ev({ fecha: '2026-10-28', fecha_fin: '2026-11-02' }))).toBe(true)
    expect(en(ev({ fecha: '2026-01-05', rrule: 'FREQ=WEEKLY' }))).toBe(true)
    expect(en(ev({ fecha: '2026-12-05', serie_id: 's', ocurrencia_original: '2026-11-20' }))).toBe(true)
  })
  it('tareas del rango y pendientes', () => {
    const en = tareaEnRango('2026-11-01', '2026-11-30')
    expect(en({ vence: '2026-11-05', hecha: true } as Tarea)).toBe(true)
    expect(en({ vence: null, hecha: false } as Tarea)).toBe(true)
    expect(en({ vence: '2026-10-01', hecha: false } as Tarea)).toBe(true)
    expect(en({ vence: '2026-10-01', hecha: true } as Tarea)).toBe(false)
  })
})

describe('recientes', () => {
  it('olvida pasado el tiempo y filtra desde un momento', () => {
    const r = new Recientes(1000)
    r.add('a', 0)
    r.add('b', 500)
    expect(r.conjunto(400, 600)).toEqual(new Set(['b']))
    expect(r.conjunto(undefined, 1200)).toEqual(new Set(['b']))
  })
})
