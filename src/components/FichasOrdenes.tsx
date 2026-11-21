// Vista «Fichas» (escritorio): cada orden en una ficha de tres zonas
// — quién (empresa, estado, subidos, objeto) · cuándo (plazos, visita, fechas) · qué (situación, tareas, notas) —
// con todo a la vista y sin barra horizontal. Se adapta al ancho: 4 columnas, luego 2 filas, luego apilada.
import { usePlazosCtx } from '../hooks'
import { fmtCorta, label, textoDias, type Orden } from '../lib/ordenes'
import { plazoDe, proximoPlazo, type ContextoPlazos, type PlazoCalc } from '../lib/plazos/motor'
import type { Evento } from '../lib/eventos'
import { useAgenda } from '../state/agenda'
import { ESTADO_CLASE } from './OrdenCard'
import { BotonProgramar, BotonVerCalendario, MarcaInhabil } from './plazos'
import { ProximaVisita, proximoOtros } from './TablaOrdenes'

/** Fecha del plazo + días que faltan (o solo la fecha si la orden está finalizada) */
function ValorPlazo({ p, fin }: { p: PlazoCalc | null; fin: boolean }) {
  if (!p) return <span className="muted">—</span>
  if (fin) return <span className="mono muted">{fmtCorta(p.fecha)}</span>
  return (
    <span className="f-val">
      <span className="mono">{fmtCorta(p.fecha)}</span>
      <MarcaInhabil inhabil={p.inhabil} />
      <span className={`dpill n-${p.nivel}`}>{textoDias(p.dias)}</span>
    </span>
  )
}

/** Comparecencia / Doc. / Claves: icono + nombre corto */
function Subida({ corto, largo, v }: { corto: string; largo: string; v: string | null }) {
  const [cls, icono, txt] = v === 'SI' ? ['si', 'check_circle', 'Sí'] : v === 'NO SE PONE' ? ['no', 'remove', 'No se pone'] : ['pte', 'radio_button_unchecked', 'Pendiente']
  return (
    <span className={`f-sub ${cls}`} title={`${largo}: ${txt}`}>
      <span className="icon" aria-hidden>
        {icono}
      </span>
      {corto}
      <span className="sr-only">: {txt}</span>
    </span>
  )
}

/** Texto largo con su etiqueta; se recorta a 1 o 2 líneas y el completo sale al pasar el ratón */
function Texto({ l, v, uno }: { l: string; v: string | null; uno?: boolean }) {
  return (
    <div className={`f-t${uno ? ' uno' : ''}`}>
      <span className="f-l">{l}</span>
      {v ? (
        <span className="f-v" title={v}>
          {v}
        </span>
      ) : (
        <span className="f-v muted">—</span>
      )}
    </div>
  )
}

function Ficha({ o, ctx, prox, onOpen }: { o: Orden; ctx: ContextoPlazos; prox: ReadonlyMap<string, Evento>; onOpen: (o: Orden) => void }) {
  const fin = o.estado === 'FINALIZADA'
  // Plazos: los dos del Excel siempre, y los añadidos en Ajustes si aplican
  const filas: { id: string; titulo: string; p: PlazoCalc | null }[] = [
    { id: 'lim9', titulo: 'Límite 9 meses', p: plazoDe(o, 'lim9', ctx) },
    { id: 'sig', titulo: 'Sig. actuación', p: plazoDe(o, 'sig', ctx) },
    ...(fin ? [] : proximoOtros(o, ctx).map((p) => ({ id: p.regla.id, titulo: p.regla.nombre, p }))),
  ]
  // El más urgente se remarca (en vez de repetirlo aparte)
  const masUrgente = fin ? null : (proximoPlazo(o, ctx)?.regla.id ?? null)

  return (
    <article
      className={`oficha ${ESTADO_CLASE[o.estado]}${fin ? ' fin' : ''}`}
      tabIndex={0}
      aria-label={`Orden ${o.num_orden}, ${o.empresa}`}
      onClick={() => onOpen(o)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(o))}
    >
      {/* Quién */}
      <div className="f-quien">
        <span className="mono f-num">{o.num_orden}</span>
        <span className="f-emp" title={o.empresa}>
          {o.empresa}
        </span>
        <div className="f-fila">
          <span className={`badge sm ${ESTADO_CLASE[o.estado]}`}>{label(o.estado)}</span>
          <span className="f-subidas">
            <Subida corto="Comp." largo="Comparecencia subida" v={o.comparecencia_subida} />
            <Subida corto="Doc." largo="Documentación subida" v={o.doc_subida} />
            <Subida corto="Claves" largo="Claves" v={o.claves} />
          </span>
        </div>
        {o.objeto && (
          <span className="f-objeto" title={o.objeto}>
            {o.objeto}
          </span>
        )}
      </div>

      {/* Cuándo */}
      <div className="f-cuando">
        {filas.map((f) => (
          <div key={f.id} className={`f-fila-k${masUrgente === f.id ? ' prox' : ''}`} title={masUrgente === f.id ? 'Próximo plazo' : undefined}>
            <span className="f-k">{f.titulo}</span>
            <ValorPlazo p={f.p} fin={fin} />
          </div>
        ))}
        <div className="f-sep" />
        <div className="f-fila-k">
          <span className="f-k">Próxima visita</span>
          <ProximaVisita o={o} ctx={ctx} prox={prox} />
        </div>
        <div className="f-fila-k f-peq">
          <span className="f-k">Estado visita</span>
          <span className="f-estvis">{label(o.estado_visita)}</span>
          <span className={`tag d-${(o.estado_docum ?? '').replace(/\s/g, '')}`} title="Documentación">
            Docum.: {label(o.estado_docum)}
          </span>
        </div>
        <div className="f-fechas">
          <span>
            Orden <b className="mono">{fmtCorta(o.fecha_orden)}</b>
          </span>
          <span>
            1ª act. <b className="mono">{fmtCorta(o.fecha_primera_actuacion)}</b>
          </span>
          <span>
            Últ. act. <b className="mono">{fmtCorta(o.fecha_ultima_actuacion)}</b>
          </span>
        </div>
      </div>

      {/* Qué */}
      <div className="f-que">
        <Texto l="Situación" v={o.situacion_general} />
        <Texto l="Tareas" v={o.tareas_pendientes} />
        <Texto l="Notas visita" v={o.fecha_visita} uno />
      </div>

      <div className="f-acc">
        {!fin && <BotonProgramar orden={o} />}
        <BotonVerCalendario orden={o} />
      </div>
    </article>
  )
}

export function FichasOrdenes({ ordenes, onOpen }: { ordenes: Orden[]; onOpen: (o: Orden) => void }) {
  const ctx = usePlazosCtx()
  const { proximas } = useAgenda()
  return (
    <ul className="fichas" data-tour="lista">
      {ordenes.map((o) => (
        <li key={o.id}>
          <Ficha o={o} ctx={ctx} prox={proximas} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}
