// Historial de una orden: todo lo que ha pasado, por fecha, con los días entre cada cosa.
// Se carga al abrirlo (no antes), para no gastar datos si no se mira.
import { useEffect, useState } from 'react'
import { api } from '../data/api'
import { usePlazosCtx } from '../hooks'
import { fmt, nombreDia } from '../lib/fechas'
import { construirHistorial, type CambioHistorial } from '../lib/historial'
import type { Orden } from '../lib/ordenes'
import { useAgenda } from '../state/agenda'

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`

export function HistorialOrden({ orden }: { orden: Orden }) {
  const ctx = usePlazosCtx()
  const ag = useAgenda()
  const [abierto, setAbierto] = useState(false)
  const [cambios, setCambios] = useState<CambioHistorial[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!abierto) return
    let vivo = true
    ;(async () => {
      const r = await (await api()).listarHistorial(orden.id)
      if (!vivo) return
      if (r.error !== null) setError(r.error)
      else setCambios(r.data)
    })()
    return () => {
      vivo = false
    }
    // Se recarga si la orden cambia (p. ej., al actualizarla desde una visita)
  }, [abierto, orden.id, orden.updated_at])

  const lista = abierto
    ? construirHistorial(
        orden,
        ag.eventos.filter((e) => e.orden_id === orden.id),
        ag.tareas.filter((t) => t.orden_id === orden.id),
        cambios ?? [],
        ag.tiposMap,
        ctx.hoy,
      )
    : []

  return (
    <details className="historial" onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)}>
      <summary>
        <span className="icon">history</span>
        <span className="title-m">Historial de la orden</span>
        <span className="icon chev">expand_more</span>
      </summary>
      {abierto && (
        <>
          {error && <p className="aviso-caja">No se pudo cargar todo el historial: {error}</p>}
          {cambios === null && !error ? (
            <div className="loader">
              <span />
            </div>
          ) : lista.length === 0 ? (
            <p className="body-m muted">Todavía no hay nada que mostrar.</p>
          ) : (
            <ol className="hist-lista">
              {lista.map((e) => (
                <li key={e.clave} className={`hist c-${e.clase}${e.futura ? ' futura' : ''}`}>
                  {e.desdeAnterior !== null && e.desdeAnterior > 0 && <span className="hist-salto">+{dias(e.desdeAnterior)}</span>}
                  <span className="hist-ic" aria-hidden>
                    <span className="icon">{e.icono}</span>
                  </span>
                  <span className="hist-txt">
                    <span className="hist-fecha">
                      {nombreDia(e.fecha)} {fmt(e.fecha)}
                      {e.hora && ` · ${e.hora}`}
                      {e.dia !== null && <span className="hist-dia"> · día {e.dia}</span>}
                      {e.futura && <span className="tag">Próximo</span>}
                    </span>
                    <span className="hist-tit">{e.titulo}</span>
                    {e.detalle && <span className="hist-det">{e.detalle}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="body-m muted hist-nota">
            «Día N» = días desde la fecha de la orden. Los cambios de datos se guardan desde el 19-11-2026 (antes no se registraban).
          </p>
        </>
      )}
    </details>
  )
}
