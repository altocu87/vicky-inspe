// Registros (logs) SIN datos personales: solo qué herramienta, si fue bien y cuánto tardó.
// Nunca se apuntan los argumentos, las respuestas, el usuario ni el token.

export interface Entrada {
  herramienta?: string
  evento?: 'rechazada' | 'limite' | 'demasiado_grande' | 'error'
  motivo?: string
  ok?: boolean
  ms?: number
  error?: 'usuario' | 'interno'
}

let destino: (linea: string) => void = (l) => console.log(l)

/** Para las pruebas: capturar lo que se registra */
export function cambiarDestino(f: (linea: string) => void) {
  destino = f
}

export function registrar(e: Entrada) {
  destino(JSON.stringify({ mcp: 'inspecciones', ...e }))
}
