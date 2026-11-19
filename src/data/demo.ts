// Backend de DEMOSTRACIÓN, en memoria, con datos inventados. Solo se carga en desarrollo
// con VITE_DEMO=1 (ver api.ts). Sirve para probar y hacer capturas sin datos reales.
import type { Session } from '@supabase/supabase-js'
import { addDias, edate, hoyIso } from '../lib/fechas'
import { FESTIVOS_ALBACETE } from '../lib/festivosAlbacete'
import type { Festivo } from '../lib/habiles'
import { ESTADOS_DOCUM, type Estado, type Orden } from '../lib/ordenes'
import type { ReglaFila } from '../lib/plazos/reglas'
import type { Backend } from './api'

const EMPRESAS = [
  'TALLERES PÉREZ SL',
  'CONSTRUCCIONES LA MANCHA SA',
  'BODEGAS EJEMPLO SL',
  'TRANSPORTES DEMO SL',
  'CAFETERÍA EL PRUEBA',
  'METALÚRGICA FICTICIA SA',
  'LIMPIEZAS INVENTADAS SL',
  'PANADERÍA DE MUESTRA',
  'AGRÍCOLA DEL LLANO SL',
  'HOSTAL IMAGINARIO',
  'CARPINTERÍA PRUEBAS SL',
  'ELECTRICIDAD DEMO SL',
  'RESIDENCIA EJEMPLAR',
  'FRUTAS TEST SL',
  'MUEBLES MODELO SA',
  'GESTORÍA SIMULADA SL',
  'AUTOESCUELA PRUEBA',
  'CLÍNICA DEMO SL',
  'HIERROS FICTICIOS SL',
  'IMPRENTA DE EJEMPLO',
  'COOPERATIVA MUESTRA',
  'TEXTIL INVENTADO SA',
  'BAR LA PRUEBA',
  'OBRAS Y REFORMAS DEMO',
  'QUESOS DE EJEMPLO SL',
]

function generar(): Orden[] {
  const hoy = hoyIso()
  return EMPRESAS.map((empresa, i) => {
    // Plazos repartidos: vencidos, esta semana, próximas semanas y meses
    const primera = addDias(edate(hoy, -9), 40 - i * 9)
    const ultima = i % 3 === 0 ? null : addDias(edate(hoy, -5), 25 - i * 4)
    const estado: Estado = i === 24 ? 'FINALIZADA' : i % 5 === 4 ? 'PTE ENTREGA' : 'EN CURSO'
    return {
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      num_orden: `2/00${String(4800 + i * 7).padStart(5, '0')}/26`,
      estado,
      empresa,
      fecha_orden: addDias(primera, -20),
      fecha_primera_actuacion: primera,
      fecha_ultima_actuacion: ultima,
      fecha_cierre: estado === 'FINALIZADA' ? hoy : null,
      objeto: i % 2 ? 'APORTA TODO LO SOLICITADO' : null,
      estado_docum: ESTADOS_DOCUM[i % 4],
      estado_visita: i % 4 === 0 ? 'REALIZADA' : 'SIN VISITA',
      fecha_visita: i % 4 === 0 ? '14/04/2026' : 'NO VISITA',
      situacion_general: null,
      tareas_pendientes: i % 6 === 0 ? 'Pedir contratos de trabajo' : null,
      comparecencia_subida: i % 2 ? 'SI' : null,
      doc_subida: null,
      claves: i % 3 ? 'SI' : null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
  })
}

let ordenes = generar()
let festivos: Festivo[] = [...FESTIVOS_ALBACETE]
let reglas: ReglaFila[] = []
const espera = () => new Promise((r) => setTimeout(r, 120))
const sesionDemo = { user: { email: 'demo@ejemplo.test', id: 'demo' } } as unknown as Session

export const backendDemo: Backend = {
  async sesion() {
    return sesionDemo
  },
  alCambiarSesion() {
    return () => {}
  },
  async entrar() {
    return null
  },
  async salir() {},
  async listarOrdenes() {
    await espera()
    return { data: [...ordenes], error: null }
  },
  async crearOrden(p) {
    const o = { ...(p as Orden), id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ordenes = [o, ...ordenes]
    return { data: o, error: null }
  },
  async actualizarOrden(id, p) {
    const o = { ...ordenes.find((x) => x.id === id)!, ...p, updated_at: new Date().toISOString() } as Orden
    ordenes = ordenes.map((x) => (x.id === id ? o : x))
    return { data: o, error: null }
  },
  async eliminarOrden(id) {
    ordenes = ordenes.filter((x) => x.id !== id)
    return null
  },
  async listarFestivos(desde, hasta) {
    return { data: festivos.filter((f) => f.fecha >= desde && f.fecha <= hasta), error: null }
  },
  async guardarFestivo(f) {
    festivos = [...festivos.filter((x) => x.fecha !== f.fecha), f].sort((a, b) => a.fecha.localeCompare(b.fecha))
    return null
  },
  async eliminarFestivo(fecha) {
    festivos = festivos.filter((x) => x.fecha !== fecha)
    return null
  },
  async listarReglas() {
    return { data: [...reglas], error: null }
  },
  async guardarRegla(r) {
    const prev = reglas.find((x) => x.id === r.id)
    const fila = {
      base: false,
      activa: true,
      nombre: null,
      corto: null,
      partida: null,
      unidad: null,
      cantidad: null,
      tope: null,
      estados: null,
      avisos: null,
      ...prev,
      ...r,
    }
    reglas = [...reglas.filter((x) => x.id !== r.id), fila]
    return null
  },
  async activarRegla(id, base, activa) {
    return this.guardarRegla({ id, base, activa })
  },
  async eliminarRegla(id) {
    reglas = reglas.filter((x) => x.id !== id || x.base)
    return null
  },
}
