// Piezas comunes de las vistas hechas a mano (Hoy, Día, Semana y Mes del móvil).
import { enlaceMapa, esquemaPermitido } from '../../lib/eventos'
import { fmt, nombreDia, nombreMesCorto, parse } from '../../lib/fechas'
import type { ItemCal } from '../../lib/capas'
import { esDiaVisita, esOficina } from '../../lib/semana'
import type { Tarea } from '../../lib/tareas'
import { useAcciones } from '../../state/acciones'

/** Una fila: icono, hora, título y detalle. Botones grandes para el dedo. */
export function ItemFila({ i, conMapa }: { i: ItemCal; conMapa?: boolean }) {
  const { verItem, alternarTarea, tareasEnCurso } = useAcciones()
  const ev = i.ref.tipo === 'evento' ? i.ref.oc.evento : null
  const mapa = conMapa && ev && ev.estado === 'pendiente' ? enlaceMapa(ev.ubicacion) : null
  const tarea = i.ref.tipo === 'tarea' ? i.ref.tarea : null
  return (
    <li className={`ifila c-${i.capa} ${i.tono}${i.hecho ? ' hecho' : ''}`}>
      {tarea ? (
        <button
          className="icon-btn ifila-check"
          aria-label={tarea.hecha ? `Marcar «${tarea.titulo}» como no hecha` : `Marcar «${tarea.titulo}» como hecha`}
          disabled={tareasEnCurso.has(tarea.id)}
          onClick={() => alternarTarea(tarea)}
        >
          <span className="icon">{tarea.hecha ? 'check_box' : 'check_box_outline_blank'}</span>
        </button>
      ) : (
        <span className="ifila-ic" aria-hidden>
          <span className="icon fill">{i.icono}</span>
        </span>
      )}
      <button className="ifila-main" onClick={() => verItem(i)}>
        <span className="ifila-hora">{i.hora ? (i.hora_fin ? `${i.hora}–${i.hora_fin}` : i.hora) : i.capa === 'plazos' ? 'Vence' : ''}</span>
        <span className="ifila-txt">
          <span className="ifila-tit">{i.titulo}</span>
          {i.detalle && <span className="ifila-det">{i.detalle}</span>}
          {ev?.ubicacion && <span className="ifila-det ifila-dir">{ev.ubicacion}</span>}
        </span>
      </button>
      {mapa && esquemaPermitido(mapa) && (
        <a className="icon-btn tonal ifila-mapa" href={mapa} target="_blank" rel="noopener noreferrer" aria-label={`Cómo llegar a ${ev!.ubicacion}`} title="Cómo llegar">
          <span className="icon">directions</span>
        </a>
      )}
    </li>
  )
}

/** Marca del día: Oficina (lunes), Día de visitas (domingo y lunes) y festivo */
export function MarcasDia({ fecha, festivo }: { fecha: string; festivo?: string | null }) {
  return (
    <>
      {esOficina(fecha) && (
        <span className="mdia oficina">
          <span className="icon">work</span>Oficina
        </span>
      )}
      {esDiaVisita(fecha) && (
        <span className="mdia visita">
          <span className="icon">directions_car</span>Visitas
        </span>
      )}
      {festivo && (
        <span className="mdia festivo">
          <span className="icon">celebration</span>
          {festivo}
        </span>
      )}
    </>
  )
}

/** Lista de un día: cabecera con sus marcas, lo que hay y, si es lunes, las tareas para la oficina */
export function DiaLista({
  fecha,
  items,
  hoy,
  oficina = [],
  festivo,
  vacio = 'Nada',
  conMapa,
  onNuevo,
}: {
  fecha: string
  items: readonly ItemCal[]
  hoy: string
  oficina?: readonly Tarea[]
  festivo?: string | null
  vacio?: string
  conMapa?: boolean
  onNuevo?: (fecha: string) => void
}) {
  const d = parse(fecha)
  const deOficina = oficina.filter((t) => !items.some((i) => i.ref.tipo === 'tarea' && i.ref.tarea.id === t.id))
  const sinFestivo = items.filter((i) => i.capa !== 'festivos')
  return (
    <section className={`dia${fecha === hoy ? ' es-hoy' : ''}${esDiaVisita(fecha) ? ' de-visita' : ''}${esOficina(fecha) ? ' de-oficina' : ''}`} aria-label={`${nombreDia(fecha)} ${fmt(fecha)}`}>
      <header className="dia-cab">
        <span className="dia-num" aria-hidden>
          <span className="dn-dia">{nombreDia(fecha)}</span>
          <span className="dn-n">{d.getDate()}</span>
          <span className="dn-mes">{nombreMesCorto(fecha)}</span>
        </span>
        <span className="dia-marcas">
          {fecha === hoy && <span className="mdia hoy">Hoy</span>}
          <MarcasDia fecha={fecha} festivo={festivo} />
        </span>
        {onNuevo && (
          <button className="icon-btn" aria-label={`Añadir el ${fmt(fecha)}`} title="Añadir" onClick={() => onNuevo(fecha)}>
            <span className="icon">add</span>
          </button>
        )}
      </header>
      {sinFestivo.length === 0 && deOficina.length === 0 ? (
        <p className="dia-vacio body-m muted">{vacio}</p>
      ) : (
        <ul className="ilista">
          {sinFestivo.map((i) => (
            <ItemFila key={i.clave} i={i} conMapa={conMapa} />
          ))}
        </ul>
      )}
      {deOficina.length > 0 && <TareasOficina tareas={deOficina} />}
    </section>
  )
}

export function TareasOficina({ tareas }: { tareas: readonly Tarea[] }) {
  return (
    <div className="oficina-caja">
      <p className="label-l">
        <span className="icon">work</span> Para la oficina
      </p>
      <ul className="ilista">
        {tareas.map((t) => (
          <ItemFila
            key={t.id}
            i={{
              clave: 'o:' + t.id,
              capa: 'tareas',
              fecha: t.vence ?? '',
              fecha_fin: null,
              hora: t.hora,
              hora_fin: null,
              titulo: t.titulo,
              detalle: t.vence ? null : 'Sin fecha',
              icono: 'task_alt',
              tono: `t-${t.prioridad}`,
              orden_id: t.orden_id,
              ref: { tipo: 'tarea', tarea: t },
              movible: false,
              hecho: t.hecha,
            }}
          />
        ))}
      </ul>
    </div>
  )
}
