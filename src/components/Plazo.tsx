import { fmt, type Plazo as P } from '../lib/ordenes'

function textoDias(dias: number) {
  if (dias < 0) return `Vencido hace ${-dias} d`
  if (dias === 0) return 'Vence hoy'
  return `${dias} días`
}

const ICONO = { ok: 'check_circle', medio: 'schedule', urgente: 'warning', vencido: 'error' } as const

export function Plazo({ titulo, plazo, finalizada, vacio }: { titulo: string; plazo: P | null; finalizada?: boolean; vacio: string }) {
  if (!plazo) {
    return (
      <div className="plazo n-none">
        <span className="icon">event_busy</span>
        <div>
          <div className="ttl">{titulo}</div>
          <div className="val muted">{vacio}</div>
        </div>
      </div>
    )
  }
  const nivel = finalizada ? 'none' : plazo.nivel
  return (
    <div className={`plazo n-${nivel}`}>
      <span className={`icon${nivel !== 'none' ? ' fill' : ''}`}>{nivel === 'none' ? 'event_available' : ICONO[plazo.nivel]}</span>
      <div>
        <div className="ttl">{titulo}</div>
        <div className="val">{fmt(plazo.fecha)}</div>
      </div>
      {!finalizada && <span className="dias">{textoDias(plazo.dias)}</span>}
    </div>
  )
}
