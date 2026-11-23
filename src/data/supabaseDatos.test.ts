import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { crearBackendSupabase } from './supabaseDatos'

describe('fechas no válidas en los filtros', () => {
  // Cliente vacío: si se llegara a usar, la prueba fallaría con una excepción
  const b = crearBackendSupabase({} as SupabaseClient)
  it('devuelven un error (no lanzan excepción) y no llegan a la base de datos', async () => {
    expect(await b.listarEventos('2026-13-40', '2026-12-31')).toEqual({ data: null, error: 'Fecha no válida' })
    expect(await b.listarTareas('2026-01-01', 'x')).toEqual({ data: null, error: 'Fecha no válida' })
    expect(await b.listarVisitasFuturas('')).toEqual({ data: null, error: 'Fecha no válida' })
  })
})
