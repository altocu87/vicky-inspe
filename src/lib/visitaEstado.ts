// Qué cambiar en la orden cuando una visita o actuación sale HECHA o FALLIDA.
// La app SIEMPRE lo pregunta antes de guardar: esto solo calcula la propuesta.
//
// Secuencia del Excel (campo «estado_visita»):
//   SIN VISITA → 1º FALLIDA → 1º FALLIDA, 2º FALLIDA
//                           → 1º FALLIDA, REALIZADA
//   SIN VISITA → REALIZADA;  1º FALLIDA, 2º FALLIDA + hecha → REALIZADA
import type { Orden } from './ordenes'

export type Resultado = 'hecha' | 'fallida'

/** Siguiente estado de la visita, o null si no cambia */
export function siguienteEstadoVisita(actual: string | null | undefined, r: Resultado): string | null {
  const a = (actual ?? '').trim().toUpperCase() || 'SIN VISITA'
  switch (a) {
    case 'SIN VISITA':
      return r === 'hecha' ? 'REALIZADA' : '1º FALLIDA'
    case '1º FALLIDA':
      return r === 'hecha' ? '1º FALLIDA, REALIZADA' : '1º FALLIDA, 2º FALLIDA'
    case '1º FALLIDA, 2º FALLIDA':
      return r === 'hecha' ? 'REALIZADA' : null
    default:
      // REALIZADA, «1º FALLIDA, REALIZADA» o un texto libre: no se propone nada
      return null
  }
}

export interface PropuestaOrden {
  /** Nueva última actuación (null = no se propone cambio) */
  ultima: { antes: string | null; despues: string } | null
  /** Primera actuación, solo si estaba vacía */
  primera: { antes: null; despues: string } | null
  estadoVisita: { antes: string | null; despues: string } | null
}

/**
 * Propuesta de cambios en la orden al marcar una actuación del día `fecha`.
 * La última actuación solo se propone si es posterior (o no había).
 * El estado de la visita solo cambia con las visitas (no con otras citas).
 */
export function propuestaAlMarcar(
  o: Pick<Orden, 'fecha_primera_actuacion' | 'fecha_ultima_actuacion' | 'estado_visita'>,
  fecha: string,
  r: Resultado,
  esVisita: boolean,
): PropuestaOrden {
  const ultima = !o.fecha_ultima_actuacion || fecha > o.fecha_ultima_actuacion ? { antes: o.fecha_ultima_actuacion, despues: fecha } : null
  const primera = !o.fecha_primera_actuacion ? { antes: null, despues: fecha } : null
  const sig = esVisita ? siguienteEstadoVisita(o.estado_visita, r) : null
  return { ultima, primera, estadoVisita: sig ? { antes: o.estado_visita, despues: sig } : null }
}

export const hayPropuesta = (p: PropuestaOrden) => !!(p.ultima || p.primera || p.estadoVisita)
