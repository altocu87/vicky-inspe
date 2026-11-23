// Nº de orden con su marca de repetición («2.ª») cuando hay varias órdenes con el mismo nº.
import { useRepetidos } from '../hooks'
import { ordinal } from '../lib/filtros'
import type { Orden } from '../lib/ordenes'

/** Solo la marca (nada si el nº no se repite) */
export function MarcaRepetida({ id, num }: { id: string; num: string }) {
  const r = useRepetidos().get(id)
  if (!r) return null
  const t = `Nº repetido: es la ${ordinal(r.n)} de ${r.total} órdenes con el nº ${num}`
  return (
    <span className="num-rep" title={t}>
      {ordinal(r.n)}
      <span className="sr-only"> {t}</span>
    </span>
  )
}

/** Nº de orden + marca de repetición */
export function NumOrden({ o, className = 'mono' }: { o: Pick<Orden, 'id' | 'num_orden'>; className?: string }) {
  return (
    <span className="num-orden">
      <span className={className}>{o.num_orden}</span>
      <MarcaRepetida id={o.id} num={o.num_orden} />
    </span>
  )
}
