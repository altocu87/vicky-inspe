// Clase CSS e icono de cada estado de orden (compartidos por tarjetas, tabla, fichas y formulario)
export const ESTADO_CLASE: Record<string, string> = {
  'EN CURSO': 'e-curso',
  'PTE ENTREGA': 'e-pte',
  DEVUELTA: 'e-dev',
  FINALIZADA: 'e-fin',
}
export const ESTADO_ICONO: Record<string, string> = {
  'EN CURSO': 'progress_activity',
  'PTE ENTREGA': 'hourglass_top',
  DEVUELTA: 'assignment_return',
  FINALIZADA: 'task_alt',
}
