// Utilidades para exportar a CSV (Excel)

// Excel interpreta como fórmula una celda que empieza por = + - @ (también las versiones
// de ancho completo ＝ ＋ － ＠), incluso con espacios delante, o por tabulador/retorno.
// Para evitar la inyección de fórmulas se antepone un apóstrofo.
const PELIGROSO = /^[\s]*[=+\-@＝＋－＠\t\r]/

export function celdaSegura(s: string): string {
  return PELIGROSO.test(s) ? "'" + s : s
}

/** Escapa una celda para CSV separado por «;» (neutraliza fórmulas y entrecomilla si hace falta). */
export function celdaCsv(v: string): string {
  const s = celdaSegura(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
