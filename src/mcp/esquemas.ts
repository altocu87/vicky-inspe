// Esquemas ESTRICTOS de lo que puede mandar ChatGPT a cada herramienta (zod).
// Todo se valida antes de tocar nada: tipos, longitudes, fechas que existan de verdad,
// identificadores con formato UUID y valores de listas cerradas. Lo que no encaja se rechaza.
import { z } from 'zod'
import { esIso } from '../lib/fechas'
import { RE_UUID, RE_ID_TIPO, telefonoValido } from '../lib/eventos'
import { ESTADOS, ESTADOS_DOCUM, SI_NO } from '../lib/ordenes'
import { PRIORIDADES, REPETICIONES } from '../lib/tareas'

/** Fecha 'aaaa-mm-dd' que existe (no 2026-02-30), entre 1990 y 2100 */
export const fecha = z
  .string()
  .describe('Fecha aaaa-mm-dd')
  .refine((s) => esIso(s) && s >= '1990-01-01' && s <= '2100-12-31', { message: 'Fecha no válida: usa aaaa-mm-dd (por ejemplo 2026-11-23)' })

export const uuid = z.string().regex(RE_UUID, { message: 'Identificador no válido' })

export const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Hora no válida: usa HH:MM (por ejemplo 09:30)' })

// Se buscan caracteres de control A PROPÓSITO, para rechazarlos
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

const base = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { message: 'No puede estar vacío' })
    .max(max, { message: `Como mucho ${max} caracteres` })

/** Texto de una línea, sin caracteres de control */
export const texto = (max: number) => base(max).refine((s) => !CONTROL.test(s) && !/[\r\n]/.test(s), { message: 'Hay caracteres no permitidos' })

/** Texto largo (detalles, notas): permite saltos de línea */
export const textoLargo = (max: number) => base(max).refine((s) => !CONTROL.test(s), { message: 'Hay caracteres no permitidos' })

export const telefono = z.string().trim().max(20).refine(telefonoValido, { message: 'Teléfono no válido: solo cifras, espacios y +' })

export const estadoOrden = z.enum(ESTADOS)
export const estadoDocum = z.enum(ESTADOS_DOCUM)
export const siNo = z.enum(SI_NO)
export const prioridad = z.enum(PRIORIDADES)
export const repeticion = z.enum(REPETICIONES)
export const tipoCita = z.string().regex(RE_ID_TIPO, { message: 'Tipo de cita no válido' })

/** Nº de orden como lo escribe ella (letras, cifras, guiones, barras, puntos y espacios) */
export const numOrden = texto(40).refine((s) => /^[\p{L}\p{N} ._/-]+$/u.test(s), { message: 'Nº de orden no válido' })

export const limite = (porDefecto: number, max: number) => z.number().int().min(1).max(max).default(porDefecto)

/** Rango de fechas con «hasta» >= «desde» y como mucho `maxDias` días */
export function comprobarRango(desde: string, hasta: string, maxDias: number): string | null {
  if (hasta < desde) return '«hasta» no puede ser anterior a «desde»'
  const dias = (Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10)) - Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10))) / 86_400_000
  if (dias > maxDias) return `El rango es demasiado largo (como mucho ${maxDias} días)`
  return null
}
