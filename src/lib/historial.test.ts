import { describe, expect, it } from 'vitest'
import { construirHistorial, leerCambio } from './historial'
import { leerEvento, TIPOS_BASE } from './eventos'
import { tareaNueva } from './tareas'

const OID = '00000000-0000-4000-8000-000000000001'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const tipos = new Map(TIPOS_BASE.map((t) => [t.id, t]))
const orden = { id: OID, fecha_orden: '2026-01-10', fecha_primera_actuacion: '2026-02-01', fecha_ultima_actuacion: '2026-03-15', fecha_cierre: null, estado: 'DEVUELTA' as const }

describe('historial de una orden', () => {
  it('valida lo que llega de la base de datos', () => {
    expect(leerCambio({ id: 1, orden_id: OID, momento: '2026-03-01T10:00:00+00:00', tipo: 'cambio', campo: 'estado', antes: 'EN CURSO', despues: 'DEVUELTA' })).not.toBeNull()
    expect(leerCambio({ id: 'x', orden_id: OID, momento: 'ayer', tipo: 'cambio' })).toBeNull()
    expect(leerCambio({ id: 1, orden_id: OID, momento: '2026-03-01T10:00:00Z', tipo: 'borrado' })).toBeNull()
    expect(leerCambio({ id: 1, orden_id: OID, momento: '2026-03-01T10:00:00Z', tipo: 'cambio', campo: 'x; drop' })!.campo).toBeNull()
  })
  it('cronológico, con días desde la orden y desde la anterior', () => {
    const eventos = [
      leerEvento({ id: id(2), titulo: '1ª visita (Excel)', tipo: 'visita', fecha: '2026-02-20', estado: 'fallida', orden_id: OID, notas: 'Cerrado' })!,
      leerEvento({ id: id(3), titulo: 'Visita', tipo: 'visita', fecha: '2026-12-06', estado: 'pendiente', orden_id: OID })!,
      leerEvento({ id: id(4), titulo: 'Otra', tipo: 'visita', fecha: '2026-02-21', estado: 'cancelada', orden_id: OID })!,
    ]
    const tareas = [{ ...tareaNueva({ titulo: 'Pedir nóminas', orden_id: OID, hecha: true, hecha_el: '2026-03-01' }), id: id(5) }]
    const cambios = [leerCambio({ id: 7, orden_id: OID, momento: '2026-03-15T09:30:00+01:00', tipo: 'cambio', campo: 'estado', antes: 'EN CURSO', despues: 'DEVUELTA' })!]
    const h = construirHistorial(orden, eventos, tareas, cambios, tipos, '2026-11-19')
    expect(h.map((e) => [e.fecha, e.titulo, e.dia, e.desdeAnterior])).toEqual([
      ['2026-01-10', 'Fecha de la orden', 0, null],
      ['2026-02-01', '1.ª actuación', 22, 22],
      ['2026-02-20', '1ª visita (Excel): fallida', 41, 19],
      ['2026-03-01', 'Tarea hecha: Pedir nóminas', 50, 9],
      ['2026-03-15', 'Última actuación', 64, 14],
      ['2026-03-15', 'Estado: En curso → Devuelta', 64, 0],
      ['2026-12-06', 'Visita: programada', 330, 266],
    ])
    expect(h[2].detalle).toBe('Cerrado')
    expect(h[5].hora).toBe('09:30')
    expect(h[6].futura).toBe(true)
  })
})
