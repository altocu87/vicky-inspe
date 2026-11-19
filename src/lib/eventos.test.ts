import { describe, expect, it } from 'vitest'
import { combinarTipos, duplicar, enlaceMapa, enlaceTel, esquemaPermitido, leerEvento, leerTipo, ocupaDia, rruleValida, textoHora } from './eventos'

const ID = '00000000-0000-4000-8000-000000000001'
const OID = '00000000-0000-4000-8000-0000000000AA'
const base = { id: ID, titulo: 'Visita', tipo: 'visita', fecha: '2026-11-22', estado: 'pendiente' }

describe('leerEvento valida lo que llega de la base de datos', () => {
  it('fila correcta', () => {
    const e = leerEvento({ ...base, hora_inicio: '10:00:00', hora_fin: '11:30:00', todo_el_dia: false, orden_id: OID, avisos: [60, 1440] })!
    expect(e.hora_inicio).toBe('10:00')
    expect(e.hora_fin).toBe('11:30')
    expect(e.todo_el_dia).toBe(false)
    expect(e.orden_id).toBe(OID.toLowerCase())
    expect(e.avisos).toEqual([60, 1440])
  })
  it('descarta filas mal formadas', () => {
    expect(leerEvento(null)).toBeNull()
    expect(leerEvento({ ...base, id: 'x' })).toBeNull()
    expect(leerEvento({ ...base, titulo: '  ' })).toBeNull()
    expect(leerEvento({ ...base, fecha: '2026-02-30' })).toBeNull()
    expect(leerEvento({ ...base, tipo: 'Visita<script>' })).toBeNull()
  })
  it('corrige valores raros sin romper', () => {
    const e = leerEvento({ ...base, estado: 'loquesea', hora_inicio: '25:00', telefono: 'javascript:alert(1)', rrule: 'FREQ=DAILY;DTSTART=20200101', orden_id: '1 or 1=1' })!
    expect(e.estado).toBe('pendiente')
    expect(e.todo_el_dia).toBe(true)
    expect(e.telefono).toBeNull()
    expect(e.rrule).toBeNull()
    expect(e.orden_id).toBeNull()
  })
  it('hora de fin anterior al inicio se ignora; fin de varios días solo si es de todo el día', () => {
    expect(leerEvento({ ...base, hora_inicio: '10:00', hora_fin: '09:00' })!.hora_fin).toBeNull()
    expect(leerEvento({ ...base, todo_el_dia: true, fecha_fin: '2026-11-24' })!.fecha_fin).toBe('2026-11-24')
    expect(leerEvento({ ...base, todo_el_dia: true, fecha_fin: '2026-11-20' })!.fecha_fin).toBeNull()
  })
})

describe('tipos de cita', () => {
  it('base + guardados, sin iconos inventados', () => {
    const t = combinarTipos([leerTipo({ id: 'requerimiento', nombre: 'Requerimiento', icono: 'description', orden: 2 })!, leerTipo({ id: 'visita', nombre: 'Visita', icono: '<img>', orden: 0 })!])
    expect(t.map((x) => x.id)).toEqual(['visita', 'comparecencia', 'requerimiento'])
    expect(t[0].icono).toBe('event')
    expect(leerTipo({ id: 'A B', nombre: 'x' })).toBeNull()
  })
})

describe('utilidades', () => {
  it('rrule permitida', () => {
    expect(rruleValida('FREQ=WEEKLY;BYDAY=MO,TU;UNTIL=20261231')).toBe(true)
    expect(rruleValida('FREQ=WEEKLY;INTERVAL=2;COUNT=10')).toBe(true)
    expect(rruleValida('DTSTART:20200101T000000Z\nRRULE:FREQ=DAILY')).toBe(false)
    expect(rruleValida('FREQ=SECONDLY')).toBe(false)
  })
  it('textoHora y ocupaDia', () => {
    expect(textoHora({ todo_el_dia: true, hora_inicio: null, hora_fin: null })).toBe('Todo el día')
    expect(textoHora({ todo_el_dia: false, hora_inicio: '09:00', hora_fin: '10:00' })).toBe('09:00–10:00')
    expect(ocupaDia({ fecha: '2026-11-22', fecha_fin: '2026-11-24' }, '2026-11-24')).toBe(true)
    expect(ocupaDia({ fecha: '2026-11-22', fecha_fin: null }, '2026-11-23')).toBe(false)
  })
  it('duplicar mantiene la duración y no copia la serie', () => {
    const e = leerEvento({ ...base, todo_el_dia: true, fecha_fin: '2026-11-24', rrule: 'FREQ=WEEKLY', estado: 'hecha' })!
    const d = duplicar(e, '2026-12-01')
    expect(d).toMatchObject({ fecha: '2026-12-01', fecha_fin: '2026-12-03', rrule: null, estado: 'pendiente', origen: 'app' })
  })
})

describe('enlaces externos seguros', () => {
  it('mapa codifica la dirección y usa https', () => {
    const u = enlaceMapa('C/ Mayor 1, Albacete & "x" <script>')!
    expect(u.startsWith('https://www.google.com/maps/search/?api=1&query=')).toBe(true)
    expect(u).not.toMatch(/[<>" ]/)
    expect(esquemaPermitido(u)).toBe(true)
    expect(enlaceMapa('  ')).toBeNull()
  })
  it('tel solo con números', () => {
    expect(enlaceTel('+34 600 11 22 33')).toBe('tel:%2B34600112233')
    expect(enlaceTel('600;alert(1)')).toBeNull()
    expect(esquemaPermitido('javascript:alert(1)')).toBe(false)
  })
})
