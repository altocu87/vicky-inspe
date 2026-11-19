import { describe, expect, it } from 'vitest'
import { leerEvento } from './eventos'
import { ORDEN_VACIA, type Orden } from './ordenes'
import { contextoBase } from './plazos/motor'
import { ordenesConVisitaFutura, porProgramar, proximasVisitas } from './porProgramar'
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
