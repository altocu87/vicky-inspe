// Celdas de la tabla de órdenes (también se usan en la lista del móvil y en las fichas)
import { fmtCorta, textoDias, type Orden } from '../lib/ordenes'
import { proximoPlazo, type ContextoPlazos, type PlazoCalc } from '../lib/plazos/motor'
import { MarcaInhabil } from './plazos'
import { semaforoVisita } from '../lib/porProgramar'
import { textoHora, type Evento } from '../lib/eventos'
import { nombreDia } from '../lib/fechas'

export function Dias({ p, fin, conTipo }: { p: PlazoCalc | null; fin: boolean; conTipo?: boolean }) {
  if (!p) return <span className="muted">—</span>
  if (fin) return <span className="muted">{fmtCorta(p.fecha)}</span>
  return (
    <span className="dcell">
      <span className="dfecha">{fmtCorta(p.fecha)}</span>
      <MarcaInhabil inhabil={p.inhabil} />
      <span className={`dpill n-${p.nivel}`}>{textoDias(p.dias)}</span>
      {conTipo && <span className="dtipo">{p.regla.corto}</span>}
    </span>
  )
}

export function SiNoCell({ v }: { v: string | null }) {
  if (v === 'SI')
    return (
      <span className="sino si" title="Sí">
        <span className="icon fill">check_circle</span>
      </span>
    )
  if (v === 'NO SE PONE')
    return (
      <span className="sino no" title="No se pone">
        <span className="icon">remove</span>
      </span>
    )
  return (
    <span className="sino pte" title="Pendiente">
      <span className="icon">radio_button_unchecked</span>
    </span>
  )
}

const ICONO_SEMAFORO = { ok: 'event_available', tarde: 'event_busy', falta: 'warning', nada: 'remove' } as const
const TEXTO_SEMAFORO = { ok: 'Antes del plazo', tarde: 'Después del plazo', falta: 'Sin visita y con prisa', nada: '' } as const

/** Próxima visita con su semáforo frente al próximo plazo */
export function ProximaVisita({ o, ctx, prox, compacta }: { o: Orden; ctx: ContextoPlazos; prox: ReadonlyMap<string, Evento>; compacta?: boolean }) {
  if (o.estado === 'FINALIZADA') return <span className="muted">—</span>
  const v = prox.get(o.id)
  const s = semaforoVisita(v, proximoPlazo(o, ctx))
  if (!v && s === 'nada') return <span className="muted">—</span>
  return (
    <span className={`vcell sv-${s}`} title={TEXTO_SEMAFORO[s]}>
      <span className="icon" aria-hidden>
        {ICONO_SEMAFORO[s]}
      </span>
      {v ? (
        <span>
          {compacta ? '' : nombreDia(v.fecha) + ' '}
          {fmtCorta(v.fecha)}
          {!v.todo_el_dia && <span className="muted"> {textoHora(v)}</span>}
        </span>
      ) : (
        <span>Sin visita</span>
      )}
      <span className="sr-only">{TEXTO_SEMAFORO[s]}</span>
    </span>
  )
}
