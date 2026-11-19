import { describe, expect, it } from 'vitest'
import { cambiosAlHacer, leerTarea, siguienteVencimiento, tareaNueva } from './tareas'

const ID = '00000000-0000-4000-8000-000000000001'

describe('tareas', () => {
  it('valida filas', () => {
    expect(leerTarea({ id: ID, titulo: 'Llamar', prioridad: 'urgentísima', hora: '10:00', vence: null })).toMatchObject({ prioridad: 'media', hora: null })
    expect(leerTarea({ id: ID, titulo: '' })).toBeNull()
    expect(leerTarea({ id: ID, titulo: 'x', vence: '2026-11-20', hora: '09:30:00', duracion_min: 99999 })).toMatchObject({ hora: '09:30', duracion_min: null })
  })
  it('repetición: la siguiente fecha', () => {
    expect(siguienteVencimiento('2027-01-31', 'mensual')).toBe('2027-02-28')
    expect(siguienteVencimiento('2026-11-20', 'quincenal')).toBe('2026-12-04')
    expect(siguienteVencimiento('2026-11-20', 'no')).toBeNull()
  })
  it('al hacer una tarea que se repite pasa a la siguiente fecha futura', () => {
    const t = { ...tareaNueva({ titulo: 'x', vence: '2026-11-02', repeticion: 'semanal' }), id: ID }
    expect(cambiosAlHacer(t, '2026-11-19')).toEqual({ vence: '2026-11-23', hecha: false, hecha_el: '2026-11-19' })
    expect(cambiosAlHacer({ ...t, repeticion: 'no' }, '2026-11-19')).toEqual({ hecha: true, hecha_el: '2026-11-19' })
  })
})
