// Cómo se define una herramienta: nombre, descripción para ChatGPT, esquema ESTRICTO de entrada,
// si escribe o solo lee, y la función que hace el trabajo (devuelve texto en castellano).
import type { z } from 'zod'
import type { Ctx } from './comun'

export type Clase = 'lectura' | 'alta' | 'cambio'

export interface Herramienta<S extends z.ZodObject = z.ZodObject> {
  nombre: string
  titulo: string
  descripcion: string
  entrada: S
  /**
   * lectura: solo lee (ChatGPT no pide confirmación).
   * alta: crea algo nuevo. cambio: modifica algo que ya existe.
   * Las de alta y cambio NO van marcadas como «solo lectura»: ChatGPT pide confirmación antes.
   */
  clase: Clase
  ejecutar(args: z.infer<S>, ctx: Ctx): Promise<string>
}

export const herramienta = <S extends z.ZodObject>(h: Herramienta<S>) => h

/** Anotaciones MCP de cada clase (las lee ChatGPT para saber si debe pedir confirmación) */
export function anotaciones(c: Clase) {
  switch (c) {
    case 'lectura':
      return { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    case 'alta':
      return { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    case 'cambio':
      // Modifica datos que ya existen (no borra nada; lo anterior queda en el historial de la orden)
      return { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
  }
}
