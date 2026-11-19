import { describe, expect, it } from 'vitest'
import { addDias } from '../fechas'
import { FESTIVOS_ALBACETE } from '../festivosAlbacete'
import { mapaFestivos } from '../habiles'
import { diasMinimos, peorNivel, plazo9Meses, plazoSiguiente, ORDEN_VACIA, type OrdenInput } from '../ordenes'
import { contextoBase, nivelDe, peorNivelDe, plazoDe, plazosDe, plazosVigilados, proximoPlazo, type ContextoPlazos } from './motor'
import { combinarReglas, REGLAS_BASE, type ReglaFila } from './reglas'

// ---- Implementación ANTERIOR (copiada tal cual) para comparar fecha a fecha ----
function parseV(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}
function toIsoV(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function edateV(iso: string, months: number) {
  const d = parseV(iso)
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d.getDate(), last))
  return toIsoV(target)
}
function nivelV(dias: number) {
  if (dias < 0) return 'vencido'
  if (dias <= 30) return 'urgente'
  if (dias <= 90) return 'medio'
  return 'ok'
}
const diasV = (hoy: string, iso: string) => Math.round((parseV(iso).getTime() - parseV(hoy).getTime()) / 86_400_000)
function lim9V(primera: string | null, hoy: string) {
  if (!primera) return null
  const fecha = edateV(primera, 9)
  return { fecha, dias: diasV(hoy, fecha), nivel: nivelV(diasV(hoy, fecha)) }
}
function sigV(primera: string | null, ultima: string | null, hoy: string) {
  if (!ultima) return null
  let fecha = edateV(ultima, 5)
  const lim = lim9V(primera, hoy)
  if (lim && fecha > lim.fecha) fecha = lim.fecha
  return { fecha, dias: diasV(hoy, fecha), nivel: nivelV(diasV(hoy, fecha)) }
}
// -------------------------------------------------------------------------------

const HOY = '2026-11-19'
const ctx0 = contextoBase(HOY)
const orden = (p: Partial<OrdenInput> & { id?: string }) => ({ ...ORDEN_VACIA, num_orden: 'X', empresa: 'E', ...p })

describe('las dos reglas del Excel dan EXACTAMENTE las mismas fechas que antes', () => {
  it('barrido de 4 años de 1.ª actuación × varias últimas actuaciones', () => {
    let comprobadas = 0
    for (let primera = '2024-01-01'; primera <= '2027-12-31'; primera = addDias(primera, 1)) {
      for (const desfase of [null, 0, 17, 45, 90, 120, 150, 151, 200, 270, 300]) {
        const ultima = desfase === null ? null : addDias(primera, desfase)
        const o = orden({ fecha_primera_actuacion: primera, fecha_ultima_actuacion: ultima })
        expect(plazo9Meses(o, ctx0)).toEqual(lim9V(primera, HOY))
        expect(plazoSiguiente(o, ctx0)).toEqual(sigV(primera, ultima, HOY))
        comprobadas++
      }
    }
    expect(comprobadas).toBeGreaterThan(16000)
  })
  it('sin 1.ª actuación la siguiente no tiene tope', () => {
    const o = orden({ fecha_primera_actuacion: null, fecha_ultima_actuacion: '2026-10-31' })
    expect(plazoSiguiente(o, ctx0)).toEqual(sigV(null, '2026-10-31', HOY))
    expect(plazo9Meses(o, ctx0)).toBeNull()
  })
  it('peorNivel y diasMinimos coinciden con el cálculo anterior', () => {
    for (let p = '2025-06-01'; p <= '2026-12-31'; p = addDias(p, 3)) {
      for (const estado of ['EN CURSO', 'PTE ENTREGA', 'FINALIZADA'] as const) {
        const u = addDias(p, 60)
        const o = orden({ estado, fecha_primera_actuacion: p, fecha_ultima_actuacion: u })
        const a = lim9V(p, HOY)!
        const b = sigV(p, u, HOY)!
        const orden4 = ['vencido', 'urgente', 'medio', 'ok']
        const esperado = estado === 'FINALIZADA' ? null : orden4.find((n) => n === a.nivel || n === b.nivel)
        expect(peorNivel(o, ctx0)).toBe(esperado)
        expect(diasMinimos(o, ctx0)).toBe(estado === 'FINALIZADA' ? 2e9 : Math.min(a.dias, b.dias))
      }
    }
  })
  it('niveles: límites exactos', () => {
    expect([-1, 0, 30, 31, 90, 91].map(nivelDe)).toEqual(['vencido', 'urgente', 'urgente', 'medio', 'medio', 'ok'])
  })
})

describe('motor de reglas', () => {
  const fest = mapaFestivos(FESTIVOS_ALBACETE)
  const ctx = (filas: ReglaFila[]): ContextoPlazos => ({ hoy: HOY, festivos: fest, reglas: combinarReglas(filas) })
  const fila = (p: Partial<ReglaFila> & { id: string }): ReglaFila => ({
    base: false,
    activa: true,
    nombre: 'Regla',
    corto: null,
    partida: 'fecha_orden',
    unidad: 'dias',
    cantidad: 10,
    tope: null,
    estados: null,
    avisos: null,
    ...p,
  })

  it('marca el plazo que cae en sábado, domingo o festivo sin mover la fecha', () => {
    // 1.ª actuación 2026-03-08 → 9 meses = 2026-12-08 (Inmaculada)
    const p = plazoDe(orden({ fecha_primera_actuacion: '2026-03-08' }), 'lim9', { ...ctx0, festivos: fest })!
    expect(p.fecha).toBe('2026-12-08')
    expect(p.inhabil).toEqual({ motivo: 'festivo', nombre: 'Inmaculada Concepción' })
    const s = plazoDe(orden({ fecha_primera_actuacion: '2026-02-21' }), 'lim9', ctx0)!
    expect(s.fecha).toBe('2026-11-21')
    expect(s.inhabil).toEqual({ motivo: 'sábado' })
  })

  it('regla nueva en días hábiles, sin tocar pantallas', () => {
    const c = ctx([fila({ id: 'req', nombre: 'Requerimiento', unidad: 'habiles', cantidad: 10, partida: 'fecha_orden' })])
    const p = plazoDe(orden({ fecha_orden: '2026-11-27' }), 'req', c)! // vie 27-nov + 10 hábiles (8-dic festivo)
    expect(p.fecha).toBe('2026-12-14')
    expect(p.regla.nombre).toBe('Requerimiento')
  })

  it('regla en días naturales con tope de otra regla', () => {
    const c = ctx([fila({ id: 'xx', cantidad: 400, partida: 'fecha_primera_actuacion', tope: 'lim9' })])
    const p = plazoDe(orden({ fecha_primera_actuacion: '2026-01-10' }), 'xx', c)!
    expect(p.fecha).toBe('2026-10-10')
    expect(p.recortado).toBe(true)
  })

  it('topes circulares o a reglas inexistentes no cuelgan la app', () => {
    const c = ctx([fila({ id: 'aa', tope: 'bb' }), fila({ id: 'bb', tope: 'aa' }), fila({ id: 'cc', tope: 'noexiste' })])
    const ps = plazosDe(orden({ fecha_orden: '2026-11-01' }), c)
    expect(ps.find((p) => p.regla.id === 'cc')!.fecha).toBe('2026-11-11')
    expect(ps.filter((p) => ['aa', 'bb'].includes(p.regla.id))).toHaveLength(2)
  })

  it('regla que sale de un evento (fase 2): cuenta desde el último evento de ese tipo de la orden', () => {
    const reglas = [
      ...REGLAS_BASE,
      { ...REGLAS_BASE[0], id: 'tras_req', partida: { evento: 'requerimiento' }, unidad: 'dias' as const, cantidad: 10, tope: null, base: false },
    ]
    const c: ContextoPlazos = {
      hoy: HOY,
      festivos: fest,
      reglas,
      eventos: [
        { orden_id: 'o1', tipo: 'requerimiento', fecha: '2026-11-02' },
        { orden_id: 'o1', tipo: 'requerimiento', fecha: '2026-11-10' },
        { orden_id: 'o2', tipo: 'requerimiento', fecha: '2026-12-01' },
        { orden_id: 'o1', tipo: 'visita', fecha: '2026-11-30' },
      ],
    }
    expect(plazoDe(orden({ id: 'o1' }), 'tras_req', c)!.fecha).toBe('2026-11-20')
    expect(plazoDe(orden({ id: 'o3' }), 'tras_req', c)).toBeNull()
  })

  it('las finalizadas tienen fechas pero no cuentan; las reglas desactivadas tampoco', () => {
    const o = orden({ estado: 'FINALIZADA', fecha_primera_actuacion: '2026-03-01' })
    expect(plazoDe(o, 'lim9', ctx0)!.aplica).toBe(false)
    expect(peorNivelDe(o, ctx0)).toBeNull()
    const c = ctx([fila({ id: 'lim9', base: true, activa: false })])
    expect(plazosVigilados(orden({ fecha_primera_actuacion: '2026-03-01' }), c)).toHaveLength(0)
  })

  it('si «Siguiente» se recorta al límite de 9 meses, solo se vigila una vez', () => {
    const o = orden({ fecha_primera_actuacion: '2026-03-01', fecha_ultima_actuacion: '2026-10-01' })
    expect(plazosDe(o, ctx0)).toHaveLength(2)
    expect(plazosVigilados(o, ctx0).map((p) => p.regla.id)).toEqual(['lim9'])
    expect(proximoPlazo(o, ctx0)!.fecha).toBe('2026-12-01')
  })
})

describe('reglas guardadas en la base de datos', () => {
  it('ignora filas mal formadas o peligrosas', () => {
    const r = combinarReglas([
      {
        id: 'BAD ID; drop',
        base: false,
        activa: true,
        nombre: 'x',
        corto: null,
        partida: 'fecha_orden',
        unidad: 'dias',
        cantidad: 1,
        tope: null,
        estados: null,
        avisos: null,
      },
      {
        id: 'sin_nombre',
        base: false,
        activa: true,
        nombre: '  ',
        corto: null,
        partida: 'fecha_orden',
        unidad: 'dias',
        cantidad: 1,
        tope: null,
        estados: null,
        avisos: null,
      },
      {
        id: 'campo_raro',
        base: false,
        activa: true,
        nombre: 'x',
        corto: null,
        partida: 'created_by',
        unidad: 'dias',
        cantidad: 1,
        tope: null,
        estados: null,
        avisos: null,
      },
      {
        id: 'unidad_rara',
        base: false,
        activa: true,
        nombre: 'x',
        corto: null,
        partida: 'fecha_orden',
        unidad: 'años',
        cantidad: 1,
        tope: null,
        estados: null,
        avisos: null,
      },
      {
        id: 'enorme',
        base: false,
        activa: true,
        nombre: 'x',
        corto: null,
        partida: 'fecha_orden',
        unidad: 'dias',
        cantidad: 99999,
        tope: null,
        estados: null,
        avisos: null,
      },
    ])
    expect(r.map((x) => x.id)).toEqual(['lim9', 'sig'])
  })
  it('aplica los ajustes de las reglas base y limpia los avisos', () => {
    const r = combinarReglas([
      {
        id: 'sig',
        base: true,
        activa: false,
        nombre: null,
        corto: null,
        partida: null,
        unidad: null,
        cantidad: null,
        tope: null,
        estados: null,
        avisos: [7, 30, 7, 0],
      },
    ])
    const sig = r.find((x) => x.id === 'sig')!
    expect(sig.activa).toBe(false)
    expect(sig.avisos).toEqual([30, 7, 0])
    expect(sig.cantidad).toBe(5) // la definición base no se puede cambiar desde la base de datos
    const malos = combinarReglas([
      {
        ...{ id: 'lim9', base: true, activa: true, nombre: null, corto: null, partida: null, unidad: null, cantidad: null, tope: null, estados: null },
        avisos: [-3, 1000],
      },
    ])
    expect(malos[0].avisos).toEqual(REGLAS_BASE[0].avisos)
  })
})
