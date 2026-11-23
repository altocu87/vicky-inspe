// Columnas de la tabla de órdenes (datos, sin componentes exportados: así funciona la recarga rápida)
import type { ReactNode } from 'react'
import { fmtCorta, label, type Orden } from '../lib/ordenes'
import { plazoActivoDe, plazoDe, proximoPlazo, type ContextoPlazos, type PlazoCalc } from '../lib/plazos/motor'
import type { Evento } from '../lib/eventos'
import { ESTADO_CLASE } from './estados'
import { Dias, ProximaVisita, SiNoCell } from './celdas'
import { NumOrden } from './NumOrden'

export type SortKey =
  | 'num_orden'
  | 'empresa'
  | 'estado'
  | 'fecha_orden'
  | 'fecha_primera_actuacion'
  | 'lim9'
  | 'fecha_ultima_actuacion'
  | 'sig'
  | 'objeto'
  | 'estado_docum'
  | 'estado_visita'
  | 'fecha_visita'
  | 'situacion_general'
  | 'tareas_pendientes'
  | 'comparecencia_subida'
  | 'doc_subida'
  | 'claves'
  | 'prox'
  | 'visita_prox'
  | 'urgencia'
export type Sort = { key: SortKey; dir: 'asc' | 'desc' }

export type Col = {
  key: SortKey
  label: string
  short?: string
  width?: number
  fixed?: boolean // no se puede ocultar
  align?: 'center' | 'right'
  render: (o: Orden, ctx: ContextoPlazos, prox: ReadonlyMap<string, Evento>) => ReactNode
  title?: (o: Orden) => string | undefined
}

const txt = (v: string | null) => (v ? <span className="clip">{v}</span> : <span className="muted">—</span>)

export const COLUMNAS: Col[] = [
  { key: 'num_orden', label: 'Nº orden', width: 128, fixed: true, render: (o) => <NumOrden o={o} /> },
  {
    key: 'empresa',
    label: 'Empresa',
    width: 240,
    fixed: true,
    render: (o) => <span className="clip strong">{o.empresa}</span>,
    title: (o) => o.empresa,
  },
  {
    key: 'estado',
    label: 'Estado',
    width: 128,
    render: (o) => <span className={`badge sm ${ESTADO_CLASE[o.estado]}`}>{label(o.estado)}</span>,
  },
  { key: 'fecha_orden', label: 'Fecha orden', short: 'F. orden', width: 96, render: (o) => fmtCorta(o.fecha_orden) },
  { key: 'fecha_primera_actuacion', label: '1ª actuación', short: '1ª act.', width: 96, render: (o) => fmtCorta(o.fecha_primera_actuacion) },
  {
    key: 'lim9',
    label: 'Límite 9 meses',
    short: 'Límite 9 m',
    width: 168,
    render: (o, ctx) => <Dias p={plazoActivoDe(o, 'lim9', ctx)} fin={o.estado === 'FINALIZADA'} />,
  },
  { key: 'fecha_ultima_actuacion', label: 'Última actuación', short: 'Últ. act.', width: 96, render: (o) => fmtCorta(o.fecha_ultima_actuacion) },
  {
    key: 'sig',
    label: 'Límite siguiente actuación',
    short: 'Límite sig.',
    width: 168,
    render: (o, ctx) => <Dias p={plazoActivoDe(o, 'sig', ctx)} fin={o.estado === 'FINALIZADA'} />,
  },
  {
    key: 'prox',
    label: 'Próximo plazo',
    short: 'Próx. plazo',
    width: 200,
    render: (o, ctx) => (o.estado === 'FINALIZADA' ? <span className="muted">—</span> : <Dias p={proximoPlazo(o, ctx)} fin={false} conTipo />),
  },
  {
    key: 'visita_prox',
    label: 'Próxima visita',
    short: 'Próx. visita',
    width: 168,
    render: (o, ctx, prox) => <ProximaVisita o={o} ctx={ctx} prox={prox} />,
  },
  { key: 'objeto', label: 'Objeto', width: 220, render: (o) => txt(o.objeto), title: (o) => o.objeto ?? undefined },
  {
    key: 'estado_docum',
    label: 'Documentación',
    short: 'Docum.',
    width: 116,
    render: (o) => <span className={`tag d-${(o.estado_docum ?? '').replace(/\s/g, '')}`}>{label(o.estado_docum)}</span>,
  },
  { key: 'estado_visita', label: 'Visita', width: 150, render: (o) => txt(label(o.estado_visita)), title: (o) => o.estado_visita ?? undefined },
  { key: 'fecha_visita', label: 'Notas de visita (Excel)', short: 'Notas visita', width: 140, render: (o) => txt(o.fecha_visita), title: (o) => o.fecha_visita ?? undefined },
  {
    key: 'situacion_general',
    label: 'Situación general',
    short: 'Situación',
    width: 260,
    render: (o) => txt(o.situacion_general),
    title: (o) => o.situacion_general ?? undefined,
  },
  {
    key: 'tareas_pendientes',
    label: 'Tareas pendientes',
    short: 'Tareas',
    width: 260,
    render: (o) => txt(o.tareas_pendientes),
    title: (o) => o.tareas_pendientes ?? undefined,
  },
  {
    key: 'comparecencia_subida',
    label: '¿Comparecencia subida?',
    short: 'Comp.',
    width: 72,
    align: 'center',
    render: (o) => <SiNoCell v={o.comparecencia_subida} />,
  },
  { key: 'doc_subida', label: '¿Doc. subida?', short: 'Doc.', width: 64, align: 'center', render: (o) => <SiNoCell v={o.doc_subida} /> },
  { key: 'claves', label: 'Claves', width: 68, align: 'center', render: (o) => <SiNoCell v={o.claves} /> },
]

/** Plazos de reglas añadidas en Ajustes (las dos del Excel ya se muestran aparte) */
export function proximoOtros(o: Orden, ctx: ContextoPlazos): PlazoCalc[] {
  return ctx.reglas
    .filter((r) => r.id !== 'lim9' && r.id !== 'sig' && r.activa)
    .map((r) => plazoDe(o, r.id, ctx))
    .filter((p): p is PlazoCalc => !!p && p.aplica)
}
