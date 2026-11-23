import { describe, expect, it } from 'vitest'
import { PAGINA, todasLasFilas } from './supabaseDatos'
import { COLS_ORDEN, ORDEN_VACIA, leerOrden, type Orden } from '../lib/ordenes'

describe('consultas por tandas de 1000 filas', () => {
  const tabla = Array.from({ length: 2345 }, (_, i) => ({ n: i }))
  const consulta = (pedidas: [number, number][]) => async (desde: number, hasta: number) => {
    pedidas.push([desde, hasta])
    return { data: tabla.slice(desde, Math.min(hasta + 1, desde + PAGINA)), error: null }
  }
  it('pide hasta recibir menos de una tanda y junta todo', async () => {
    const pedidas: [number, number][] = []
    const r = await todasLasFilas(consulta(pedidas), 50_000)
    expect(r.data).toHaveLength(2345)
    expect(pedidas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })
  it('respeta el tope de seguridad', async () => {
    const r = await todasLasFilas(consulta([]), 1500)
    expect(r.data).toHaveLength(1500)
  })
  it('si una tanda falla, devuelve el error (no media lista)', async () => {
    let i = 0
    const r = await todasLasFilas(async () => (i++ ? { data: null, error: { message: 'x' } } : { data: tabla.slice(0, PAGINA), error: null }), 50_000)
    expect(r.error).toEqual({ message: 'x' })
  })
})

describe('validar órdenes', () => {
  const fila = { ...ORDEN_VACIA, id: '0b0c3a3e-1d2f-4c5b-9a8e-7f6d5c4b3a21', num_orden: '2/1/24', empresa: 'ACME', created_at: 'c', updated_at: 'u' }
  it('pide todas las columnas del tipo Orden', () => {
    const tipo: (keyof Orden)[] = ['id', ...(Object.keys(ORDEN_VACIA) as (keyof Orden)[]), 'created_at', 'updated_at']
    expect(COLS_ORDEN.split(',').sort()).toEqual([...tipo].sort())
  })
  it('acepta una fila buena tal cual', () => expect(leerOrden(fila)).toEqual(fila))
  it('descarta filas sin id, nº, empresa o con un estado desconocido', () => {
    expect(leerOrden({ ...fila, id: 'x' })).toBeNull()
    expect(leerOrden({ ...fila, num_orden: null })).toBeNull()
    expect(leerOrden({ ...fila, estado: 'RARO' })).toBeNull()
    expect(leerOrden(null)).toBeNull()
  })
  it('vacía datos opcionales no válidos sin recortar textos', () => {
    const o = leerOrden({ ...fila, fecha_orden: '2026-02-30', estado_docum: 'OTRO', claves: 3, situacion_general: 'x'.repeat(5000) })!
    expect(o.fecha_orden).toBeNull()
    expect(o.estado_docum).toBeNull()
    expect(o.claves).toBeNull()
    expect(o.situacion_general).toHaveLength(5000)
  })
})
