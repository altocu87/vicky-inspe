// Acciones de la agenda que se pueden pedir desde cualquier pantalla (tabla, calendario, formulario de la orden).
// Las pone en marcha <GestorAgenda>, que es quien abre los formularios, las fichas y la pregunta de la orden.
import { createContext, useContext } from 'react'
import type { ItemCal } from '../lib/capas'
import type { Evento, EventoInput } from '../lib/eventos'
import type { Tarea, TareaInput } from '../lib/tareas'
import type { Resultado } from '../lib/visitaEstado'

export interface Acciones {
  /** Abre el formulario de una orden */
  abrirOrden(id: string): void
  /** Formulario de visita enlazada a una orden, con el próximo domingo o lunes libre */
  programarVisita(ordenId: string | null, fecha?: string): void
  nuevoEvento(p?: Partial<EventoInput>): void
  /** `fecha` = día de la aparición (en una serie) */
  editarEvento(e: Evento, fecha?: string): void
  nuevaTarea(p?: Partial<TareaInput>): void
  editarTarea(t: Tarea): void
  /** Pulsar algo del calendario: ficha rápida (citas y tareas) o la orden (plazos e hitos) */
  verItem(i: ItemCal): void
  marcar(e: Evento, fecha: string, r: Resultado): Promise<void>
  alternarTarea(t: Tarea): Promise<void>
  /** Tareas que se están marcando ahora mismo (su botón se desactiva para no pulsar dos veces) */
  tareasEnCurso: ReadonlySet<string>
  /** Próximo domingo o lunes libre para una visita */
  huecoVisita(desde?: string): string
  avisar(msg: string, err?: boolean): void
}

const nada = () => {}
export const AccionesCtx = createContext<Acciones>({
  abrirOrden: nada,
  programarVisita: nada,
  nuevoEvento: nada,
  editarEvento: nada,
  nuevaTarea: nada,
  editarTarea: nada,
  verItem: nada,
  marcar: async () => {},
  alternarTarea: async () => {},
  tareasEnCurso: new Set(),
  huecoVisita: () => '',
  avisar: nada,
})
export const useAcciones = () => useContext(AccionesCtx)
