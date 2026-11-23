import { describe, expect, it } from 'vitest'
import { backendDemo } from './demo'
import { eventoNuevo } from '../lib/eventos'

describe('inserción masiva (demo)', () => {
  it('crea varias citas en una llamada y las devuelve en el mismo orden', async () => {
    const r = await backendDemo.crearEventos(['2026-12-01', '2026-12-02', '2026-12-03'].map((fecha) => eventoNuevo({ fecha, tipo: 'visita', titulo: 'Visita', orden_id: null })))
    expect(r.error).toBeNull()
    expect(r.data?.map((e) => e.fecha)).toEqual(['2026-12-01', '2026-12-02', '2026-12-03'])
    expect(new Set(r.data?.map((e) => e.id)).size).toBe(3)
  })
  it('lista vacía: no hace nada', async () => {
    expect(await backendDemo.crearEventos([])).toEqual({ data: [], error: null })
    expect(await backendDemo.crearTareas([])).toEqual({ data: [], error: null })
  })
  it('si una no es válida no se crea ninguna', async () => {
    const r = await backendDemo.crearEventos([eventoNuevo({ fecha: '2026-12-01', tipo: 'visita', titulo: 'Visita', orden_id: null }), { ...eventoNuevo({ fecha: 'mal', tipo: 'visita', titulo: 'x', orden_id: null }) }])
    expect(r.data).toBeNull()
  })
})
