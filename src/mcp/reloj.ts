// «Hoy» y la hora SIEMPRE en hora de España (Europe/Madrid).
// El servidor de Supabase funciona en UTC: entre las 00:00 y las 01:00/02:00 de España
// «hoy» en UTC aún es AYER. Por eso nunca se usa new Date() a secas para sacar el día.

export const ZONA = 'Europe/Madrid'

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
const fmtHora = new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Día 'aaaa-mm-dd' en España en el instante dado */
export function diaMadrid(instante: Date): string {
  // en-CA da exactamente «2026-11-20»
  return fmtDia.format(instante)
}

/** Hora 'HH:MM' en España en el instante dado */
export function horaMadrid(instante: Date): string {
  return fmtHora.format(instante)
}

/** Reloj inyectable (en las pruebas se fija el instante) */
export interface Reloj {
  ahora(): Date
}

export const relojReal: Reloj = { ahora: () => new Date() }

export const hoyMadrid = (reloj: Reloj = relojReal) => diaMadrid(reloj.ahora())

/**
 * Pasa un instante con zona (como los del historial) a una fecha-hora SIN zona con la hora de España,
 * «2026-11-20T10:30:00». JavaScript lee ese formato como hora local, así que quien lo use
 * (construirHistorial) ve la hora de España sea cual sea la zona del servidor.
 */
export function aHoraLocalMadrid(isoConZona: string): string {
  const d = new Date(isoConZona)
  if (Number.isNaN(d.getTime())) return isoConZona
  return `${diaMadrid(d)}T${horaMadrid(d)}:00`
}
