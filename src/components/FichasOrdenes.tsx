// Vista «Fichas» (escritorio): cada orden en una ficha de cuatro secciones
// — Orden (nº, empresa, estado, objeto) · Fechas (las 7 del Excel) · Visita y documentación · Tareas —
// con todo a la vista y sin barra horizontal. Se adapta al ancho: 4 columnas, luego 2×2, luego apilada.
import type { ReactNode } from 'react'
import { usePlazosCtx } from '../hooks'
import { fmtCorta, label, textoDias, type Orden } from '../lib/ordenes'
import { plazoActivoDe, proximoPlazo, type ContextoPlazos, type PlazoCalc } from '../lib/plazos/motor'
import type { Evento } from '../lib/eventos'
import { useAgenda } from '../state/agenda'
import { ESTADO_CLASE } from './estados'
import { BotonProgramar, BotonVerCalendario, MarcaInhabil } from './plazos'
import { ProximaVisita } from './celdas'
import { proximoOtros } from './columnas'
import { NumOrden } from './NumOrden'

/** Una línea «etiqueta · valor» */
function Linea({ k, children, prox }: { k: string; children: ReactNode; prox?: boolean }) {
  return (
    <div className={`f-linea${prox ? ' prox' : ''}`} title={prox ? 'Próximo plazo' : undefined}>
      <span className="f-k">{k}</span>
      <span className="f-val">{children}</span>
    </div>
  )
}

/** Fecha introducida a mano */
const Fecha = ({ v }: { v: string | null }) => (v ? <span className="mono">{fmtCorta(v)}</span> : <span className="muted">—</span>)

/** Fecha límite calculada (con aviso si cae en día inhábil) */
function FechaLimite({ p }: { p: PlazoCalc | null }) {
  if (!p) return <span className="muted">—</span>
  return (
    <>
      <span className="mono">{fmtCorta(p.fecha)}</span>
      <MarcaInhabil inhabil={p.inhabil} />
    </>
  )
}

/** Días que quedan: «Sin tiempo», «Hoy» o «N d», con el color del nivel. En finalizadas no se cuentan. */
function Dias({ p, fin }: { p: PlazoCalc | null; fin: boolean }) {
  if (!p || fin) return <span className="muted">—</span>
  return <span className={`dpill n-${p.nivel}`}>{textoDias(p.dias)}</span>
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

/** Texto largo con su etiqueta; se recorta y el completo sale al pasar el ratón */
function Texto({ l, v, lineas = 3 }: { l: string; v: string | null; lineas?: 1 | 2 | 3 }) {
  return (
    <div className="f-t">
      <span className="f-l">{l}</span>
      {v ? (
        <span className={`f-v l${lineas}`} title={v}>
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
  const lim9 = plazoActivoDe(o, 'lim9', ctx)
  const sig = plazoActivoDe(o, 'sig', ctx)
  // Plazos creados en Ajustes: se suman al final de «Fechas»
  const otros = fin ? [] : proximoOtros(o, ctx)
  // El plazo más urgente se remarca
  const urg = fin ? null : (proximoPlazo(o, ctx)?.regla.id ?? null)

  return (
    <article
      className={`oficha ${ESTADO_CLASE[o.estado]}${fin ? ' fin' : ''}`}
      tabIndex={0}
      aria-label={`Orden ${o.num_orden}, ${o.empresa}`}
      onClick={() => onOpen(o)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(o))}
    >
      {/* 1 · Orden */}
      <div className="f-quien">
        <NumOrden o={o} className="mono f-num" />
        <span className="f-emp" title={o.empresa}>
          {o.empresa}
        </span>
        <span className={`badge sm ${ESTADO_CLASE[o.estado]}`}>{label(o.estado)}</span>
        {o.objeto && (
          <span className="f-objeto" title={o.objeto}>
            {o.objeto}
          </span>
        )}
      </div>

      {/* 2 · Fechas (mismo orden que el Excel) */}
      <div className="f-sec f-fechas">
        <h4 className="f-tit">Fechas</h4>
        <Linea k="Fecha orden">
          <Fecha v={o.fecha_orden} />
        </Linea>
        <Linea k="Fecha 1ª actuación">
          <Fecha v={o.fecha_primera_actuacion} />
        </Linea>
        <Linea k="Límite 9 meses">
          <FechaLimite p={lim9} />
        </Linea>
        <Linea k="Días actuación restantes" prox={urg === 'lim9'}>
          <Dias p={lim9} fin={fin} />
        </Linea>
        <Linea k="Fecha última actuación">
          <Fecha v={o.fecha_ultima_actuacion} />
        </Linea>
        <Linea k="Límite última actuación">
          <FechaLimite p={sig} />
        </Linea>
        <Linea k="Días sig. actuación" prox={urg === 'sig'}>
          <Dias p={sig} fin={fin} />
        </Linea>
        {otros.map((p) => (
          <Linea key={p.regla.id} k={p.regla.nombre} prox={urg === p.regla.id}>
            <FechaLimite p={p} />
            <Dias p={p} fin={fin} />
          </Linea>
        ))}
      </div>

      {/* 3 · Visita y documentación */}
      <div className="f-sec f-visita">
        <h4 className="f-tit">Visita y documentación</h4>
        <Linea k="Próxima visita">
          <ProximaVisita o={o} ctx={ctx} prox={prox} />
        </Linea>
        <Linea k="Estado visita">{label(o.estado_visita)}</Linea>
        <Linea k="Documentación">
          <span className={`tag d-${(o.estado_docum ?? '').replace(/\s/g, '')}`}>{label(o.estado_docum)}</span>
        </Linea>
        <div className="f-subidas">
          <Subida corto="Comparecencia" largo="Comparecencia subida" v={o.comparecencia_subida} />
          <Subida corto="Doc." largo="Documentación subida" v={o.doc_subida} />
          <Subida corto="Claves" largo="Claves" v={o.claves} />
        </div>
        <Texto l="Notas visita" v={o.fecha_visita} lineas={2} />
      </div>

      {/* 4 · Tareas y situación */}
      <div className="f-sec f-tareas">
        <h4 className="f-tit">Tareas</h4>
        <Texto l="Tareas pendientes" v={o.tareas_pendientes} />
        <Texto l="Situación general" v={o.situacion_general} />
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
