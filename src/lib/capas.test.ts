import { describe, expect, it } from 'vitest'
import { construirItems, porDia, contarCapas, peorNivelDia, sumarMinutos, CAPAS, type DatosCapas } from './capas'
import { leerEvento, TIPOS_BASE } from './eventos'
import { ORDEN_VACIA, type Orden } from './ordenes'
import { contextoBase } from './plazos/motor'
import { desplegar } from './repeticion'
import { tareaNueva } from './tareas'
import { semaforoVisita } from './porProgramar'

const HOY = '2026-11-19'
const oid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const orden = (n: number, p: Partial<Orden> = {}): Orden => ({ ...ORDEN_VACIA, id: oid(n), num_orden: `N${n}`, empresa: `EMPRESA ${n}`, created_at: '', updated_at: '', ...p })
const a = orden(1, { fecha_primera_actuacion: '2026-03-01', fecha_orden: '2026-02-01' }) // lim9 2026-12-01
const b = orden(2, { estado: 'PTE ENTREGA', fecha_primera_actuacion: '2026-03-05' })
const ev = (n: number, p: Record<string, unknown>) => leerEvento({ id: oid(100 + n), titulo: 'Visita', tipo: 'visita', fecha: '2026-11-22', estado: 'pendiente', ...p })!
const eventos = [ev(1, { orden_id: a.id }), ev(2, { orden_id: b.id, fecha: '2026-11-23' }), ev(3, { titulo: 'Médico', tipo: 'comparecencia', fecha: '2026-11-24', ubicacion: 'Hospital' }), ev(4, { titulo: 'Curso', todo_el_dia: true, fecha: '2026-11-25', fecha_fin: '2026-11-27' })]
const tareas = [{ ...tareaNueva({ titulo: 'Informe', vence: '2026-11-22', orden_id: b.id }), id: oid(200) }, { ...tareaNueva({ titulo: 'Sin fecha' }), id: oid(201) }]

const datos = (p: Partial<DatosCapas> = {}): DatosCapas => ({
  ocurrencias: desplegar(eventos, '2026-11-01', '2026-12-31'),
  tareas,
  visibles: [a, b],
  todas: new Map([a, b].map((o) => [o.id, o])),
  festivos: [{ fecha: '2026-12-08', nombre: 'Inmaculada', ambito: 'nacional' }],
  tipos: new Map(TIPOS_BASE.map((t) => [t.id, t])),
  ctx: contextoBase(HOY),
  filtros: { q: '', filtro: 'todos', ocultarFin: true },
  ...p,
})
const todas = new Set(CAPAS)

describe('capas del calendario', () => {
  it('junta citas, tareas, plazos y festivos (hitos solo si se pide)', () => {
    const it_ = construirItems(datos(), new Set(['plazos', 'citas', 'tareas', 'festivos']), '2026-11-01', '2026-12-31')
    expect(contarCapas(it_)).toEqual({ plazos: 2, citas: 4, tareas: 1, hitos: 0, festivos: 1 })
    expect(contarCapas(construirItems(datos(), todas, '2026-11-01', '2026-12-31')).hitos).toBe(0) // hitos fuera de rango
    expect(contarCapas(construirItems(datos(), todas, '2026-02-01', '2026-03-31')).hitos).toBe(3)
  })
  it('las citas de una orden muestran la empresa', () => {
    const v = construirItems(datos(), new Set(['citas']), '2026-11-22', '2026-11-22')
    expect(v[0]).toMatchObject({ titulo: 'EMPRESA 1', detalle: 'Visita · N1', movible: true })
  })
  it('mismos filtros que la tabla: lo de órdenes ocultas no sale; lo suelto solo sin filtro de estado', () => {
    const f = construirItems(datos({ visibles: [b], filtros: { q: '', filtro: 'PTE ENTREGA', ocultarFin: true } }), todas, '2026-11-01', '2026-12-31')
    expect(f.filter((i) => i.capa !== 'festivos').every((i) => i.orden_id === b.id)).toBe(true)
    // búsqueda: lo suelto se busca en título, lugar y notas
    const q = construirItems(datos({ filtros: { q: 'hospital', filtro: 'todos', ocultarFin: true } }), new Set(['citas']), '2026-11-01', '2026-12-31')
    expect(q.filter((i) => !i.orden_id).map((i) => i.titulo)).toEqual(['Médico'])
    // solo una orden
    const o = construirItems(datos({ ordenId: a.id }), todas, '2026-11-01', '2026-12-31')
    expect(new Set(o.filter((i) => i.capa !== 'festivos').map((i) => i.orden_id))).toEqual(new Set([a.id]))
  })
  it('por día: lo de varios días sale en cada día; orden dentro del día', () => {
    const m = porDia(construirItems(datos(), todas, '2026-11-20', '2026-11-30'), '2026-11-20', '2026-11-30')
    expect(m.get('2026-11-26')!.map((i) => i.titulo)).toEqual(['Curso'])
    expect(m.get('2026-11-22')!.map((i) => i.capa)).toEqual(['citas', 'tareas'])
    expect(m.size).toBe(11)
  })
  it('peor nivel del día y suma de minutos', () => {
    const m = porDia(construirItems(datos(), todas, '2026-12-01', '2026-12-01'), '2026-12-01', '2026-12-01')
    expect(peorNivelDia(m.get('2026-12-01')!)).toBe('urgente')
    expect(sumarMinutos('23:30', 90)).toBe('23:59')
  })
  it('semáforo de la próxima visita', () => {
    expect(semaforoVisita({ fecha: '2026-11-22' }, { fecha: '2026-12-01', dias: 12 })).toBe('ok')
    expect(semaforoVisita({ fecha: '2026-12-02' }, { fecha: '2026-12-01', dias: 12 })).toBe('tarde')
    expect(semaforoVisita(undefined, { fecha: '2026-12-01', dias: 12 })).toBe('falta')
    expect(semaforoVisita(undefined, { fecha: '2027-12-01', dias: 400 })).toBe('nada')
  })
})
