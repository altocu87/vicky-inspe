import { describe, expect, it } from 'vitest'
import { mapaFestivos, SIN_FESTIVOS } from './habiles'
import { esDiaVisita, esOficina, proximoHuecoVisita, proximoLunes, tareasOficina, visitasPorDia } from './semana'
import { tareaNueva, type Tarea } from './tareas'

const t = (p: Partial<Tarea>): Tarea => ({ ...tareaNueva({ titulo: 'x', ...p }), id: '00000000-0000-4000-8000-000000000001' })

describe('semana de trabajo', () => {
  it('lunes oficina; domingo y lunes de visita', () => {
    expect(esOficina('2026-11-23')).toBe(true)
    expect(esDiaVisita('2026-11-22')).toBe(true)
    expect(esDiaVisita('2026-11-23')).toBe(true)
    expect(esDiaVisita('2026-11-24')).toBe(false)
  })
  it('próximo domingo o lunes libre', () => {
    // jueves 19-11-2026 → domingo 22
    expect(proximoHuecoVisita('2026-11-19', new Map(), SIN_FESTIVOS)).toBe('2026-11-22')
    // domingo lleno → lunes 23
    expect(proximoHuecoVisita('2026-11-19', new Map([['2026-11-22', 4]]), SIN_FESTIVOS)).toBe('2026-11-23')
    // hoy domingo libre → hoy
    expect(proximoHuecoVisita('2026-11-22', new Map(), SIN_FESTIVOS)).toBe('2026-11-22')
    // se salta festivos: lunes 7-12 normal, martes 8 festivo no es de visita; domingo 6 festivo? (Constitución, en domingo)
    const f = mapaFestivos([{ fecha: '2026-12-06', nombre: 'Constitución', ambito: 'nacional' }])
    expect(proximoHuecoVisita('2026-12-01', new Map(), f)).toBe('2026-12-07')
  })
  it('cuenta solo visitas pendientes', () => {
    const m = visitasPorDia([
      { tipo: 'visita', fecha: '2026-11-22', estado: 'pendiente' },
      { tipo: 'visita', fecha: '2026-11-22', estado: 'hecha' },
      { tipo: 'comparecencia', fecha: '2026-11-22', estado: 'pendiente' },
    ])
    expect(m.get('2026-11-22')).toBe(1)
  })
  it('tareas para la oficina del lunes', () => {
    const ts = [t({ oficina: true }), t({ oficina: true, vence: '2026-11-30' }), t({ oficina: true, hecha: true }), t({})]
    expect(tareasOficina(ts, '2026-11-23')).toHaveLength(1)
    expect(tareasOficina(ts, '2026-11-30')).toHaveLength(2)
    expect(tareasOficina(ts, '2026-11-24')).toHaveLength(0)
    expect(proximoLunes('2026-11-19')).toBe('2026-11-23')
  })
})
