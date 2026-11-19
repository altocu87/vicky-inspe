// Pantalla #calendario. Recibe las órdenes YA filtradas por los mismos filtros que la tabla
// (estado, «urgentes», «sin tiempo», búsqueda): un solo estado para las dos vistas.
// Fase 1: vista «Plazos». Fase 2 añadirá Hoy/Agenda, Día, Semana, Mes y Año.
import { usePref } from '../../hooks'
import { fmt, hoyIso, nombreDia } from '../../lib/fechas'
import type { Orden } from '../../lib/ordenes'
import type { Nivel } from '../../lib/plazos/motor'
import type { Ruta } from '../../lib/ruta'
import { irA } from '../../nav'
import { VistaPlazos } from './VistaPlazos'

export function Calendario({
  ordenes,
  todas,
  ruta,
  onOpen,
}: {
  ordenes: Orden[]
  /** Todas las órdenes, sin filtrar: «Ver en el calendario» de una orden la muestra aunque los filtros la oculten */
  todas: Orden[]
  ruta: Ruta
  onOpen: (o: Orden) => void
}) {
  const [reglasSel, setReglasSel] = usePref<string[]>('cal:reglas', [])
  const [nivelesSel, setNivelesSel] = usePref<Nivel[]>('cal:niveles', [])
  const hoy = hoyIso()

  return (
    <div className="calendario">
      <div className="cal-head">
        <p className="label-l muted cal-hoy">
          Hoy, {nombreDia(hoy)} {fmt(hoy)}
        </p>
        <div className="seg mini" role="tablist" aria-label="Vista del calendario">
          <button role="tab" aria-selected className="on" title="Plazos (P)">
            <span className="icon">flag</span>
            Plazos
          </button>
        </div>
      </div>
      <VistaPlazos
        ordenes={ruta.orden ? todas : ordenes}
        ordenId={ruta.orden}
        reglasSel={reglasSel}
        setReglasSel={setReglasSel}
        nivelesSel={nivelesSel}
        setNivelesSel={setNivelesSel}
        onOpen={onOpen}
        onQuitarOrden={() => irA({ pantalla: 'calendario', vista: 'plazos' }, true)}
      />
    </div>
  )
}
