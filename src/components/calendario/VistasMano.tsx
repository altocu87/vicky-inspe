// Vistas hechas a mano (se leen bien en el móvil): Hoy/Agenda, Día, Semana en lista, Mes compacto y Año.
import { addDias, diaSemana, fmt, lunesDe, nombreMes, parse } from '../../lib/fechas'
import { peorNivelDia, type ItemCal } from '../../lib/capas'
import { esDiaVisita, esOficina, tareasOficina } from '../../lib/semana'
import type { Tarea } from '../../lib/tareas'
import type { MapaFestivos } from '../../lib/habiles'
import { DiaLista, ItemFila } from './comun'

const INICIALES = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

interface Comun {
  hoy: string
  porDia: ReadonlyMap<string, ItemCal[]>
  tareas: readonly Tarea[]
  festivos: MapaFestivos
  onNuevo: (fecha: string) => void
}

/** HOY / AGENDA: lo de hoy arriba (visitas con hora y dirección, plazos que vencen, tareas) y luego los próximos días */
export function VistaHoy({ hoy, porDia, tareas, festivos, onNuevo, atrasadas, vencidos, onVerPlazos }: Comun & { atrasadas: readonly ItemCal[]; vencidos: number; onVerPlazos: () => void }) {
  const dias = [...porDia.keys()].filter((d) => d > hoy)
  return (
    <div className="vhoy">
      {(vencidos > 0 || atrasadas.length > 0) && (
        <div className="aviso-hoy" role="note">
          {vencidos > 0 && (
            <button className="btn tonal ko" onClick={onVerPlazos}>
              <span className="icon">error</span>
              {vencidos} {vencidos === 1 ? 'plazo vencido' : 'plazos vencidos'}
            </button>
          )}
          {atrasadas.length > 0 && (
            <div className="atrasadas">
              <p className="label-l">Tareas atrasadas</p>
              <ul className="ilista">
                {atrasadas.map((i) => (
                  <ItemFila key={i.clave} i={i} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <DiaLista
        fecha={hoy}
        items={porDia.get(hoy) ?? []}
        hoy={hoy}
        oficina={tareasOficina(tareas, hoy, hoy)}
        festivo={festivos.get(hoy)?.nombre}
        vacio="Hoy no tienes nada en el calendario."
        conMapa
        onNuevo={onNuevo}
      />
      <h2 className="pgrupo-t">Próximos días</h2>
      {dias
        .filter((d) => (porDia.get(d) ?? []).some((i) => i.capa !== 'festivos') || esDiaVisita(d) || festivos.has(d))
        .map((d) => (
          <DiaLista
            key={d}
            fecha={d}
            items={porDia.get(d) ?? []}
            hoy={hoy}
            oficina={tareasOficina(tareas, d, hoy)}
            festivo={festivos.get(d)?.nombre}
            vacio={esDiaVisita(d) ? 'Libre para visitas' : 'Nada'}
            conMapa
            onNuevo={onNuevo}
          />
        ))}
    </div>
  )
}

/** DÍA en el móvil: la lista de ese día */
export function VistaDiaLista({ fecha, hoy, porDia, tareas, festivos, onNuevo }: Comun & { fecha: string }) {
  return (
    <DiaLista
      fecha={fecha}
      items={porDia.get(fecha) ?? []}
      hoy={hoy}
      oficina={tareasOficina(tareas, fecha, hoy)}
      festivo={festivos.get(fecha)?.nombre}
      vacio={esDiaVisita(fecha) ? 'Libre para visitas' : 'Nada este día'}
      conMapa
      onNuevo={onNuevo}
    />
  )
}

/** SEMANA en el móvil: los 7 días en lista (no una rejilla con horas) */
export function VistaSemanaLista({ fecha, hoy, porDia, tareas, festivos, onNuevo }: Comun & { fecha: string }) {
  const lunes = lunesDe(fecha)
  return (
    <div className="vsemana">
      {Array.from({ length: 7 }, (_, i) => addDias(lunes, i)).map((d) => (
        <DiaLista
          key={d}
          fecha={d}
          items={porDia.get(d) ?? []}
          hoy={hoy}
          oficina={tareasOficina(tareas, d, hoy)}
          festivo={festivos.get(d)?.nombre}
          vacio={esDiaVisita(d) ? 'Libre para visitas' : 'Nada'}
          onNuevo={onNuevo}
        />
      ))}
    </div>
  )
}

/** Puntos de color de un día (máx. 4) */
function Puntos({ items }: { items: readonly ItemCal[] }) {
  const nivel = peorNivelDia(items)
  const capas = new Set(items.map((i) => i.capa))
  return (
    <span className="puntos" aria-hidden>
      {nivel && <span className={`punto n-${nivel}`} />}
      {capas.has('citas') && <span className="punto c-citas" />}
      {capas.has('tareas') && <span className="punto c-tareas" />}
      {capas.has('hitos') && <span className="punto c-hitos" />}
    </span>
  )
}

function textoDia(fecha: string, items: readonly ItemCal[]) {
  const n = items.filter((i) => i.capa !== 'festivos').length
  return `${fmt(fecha)}${n ? `, ${n} ${n === 1 ? 'cosa' : 'cosas'}` : ''}${esOficina(fecha) ? ', oficina' : ''}`
}

/** Rejilla de un mes (lunes a domingo) */
function Rejilla({
  mes,
  hoy,
  sel,
  porDia,
  festivos,
  onDia,
  mini,
}: {
  mes: string
  hoy: string
  sel?: string
  porDia: ReadonlyMap<string, ItemCal[]>
  festivos: MapaFestivos
  onDia: (f: string) => void
  mini?: boolean
}) {
  const primero = mes.slice(0, 7) + '-01'
  const inicio = lunesDe(primero)
  const semanas = Math.ceil((((diaSemana(primero) + 6) % 7) + new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate()) / 7)
  return (
    <div className={`rejilla${mini ? ' mini' : ''}`} role="grid" aria-label={nombreMes(primero)}>
      <div className="rj-cab" role="row">
        {INICIALES.map((l, i) => (
          <span key={l} role="columnheader" className={i === 0 ? 'rj-of' : i === 6 ? 'rj-vi' : ''}>
            {l}
          </span>
        ))}
      </div>
      {Array.from({ length: semanas }, (_, s) => (
        <div className="rj-fila" role="row" key={s}>
          {Array.from({ length: 7 }, (_, d) => {
            const f = addDias(inicio, s * 7 + d)
            const fuera = f.slice(0, 7) !== mes.slice(0, 7)
            const items = porDia.get(f) ?? []
            if (fuera) return <span key={f} className="rj-dia fuera" role="gridcell" aria-hidden />
            return (
              <button
                key={f}
                role="gridcell"
                aria-selected={f === sel}
                className={`rj-dia${f === hoy ? ' hoy' : ''}${f === sel ? ' sel' : ''}${esDiaVisita(f) ? ' de-visita' : ''}${esOficina(f) ? ' de-oficina' : ''}${festivos.has(f) ? ' festivo' : ''}`}
                onClick={() => onDia(f)}
                aria-label={textoDia(f, items)}
              >
                <span className="rj-n">{parse(f).getDate()}</span>
                <Puntos items={items} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** MES en el móvil: calendario compacto con puntos; al tocar un día, su lista debajo */
export function VistaMesMovil({ fecha, hoy, porDia, tareas, festivos, onNuevo, onElegir }: Comun & { fecha: string; onElegir: (f: string) => void }) {
  return (
    <div className="vmes">
      <Rejilla mes={fecha} hoy={hoy} sel={fecha} porDia={porDia} festivos={festivos} onDia={onElegir} />
      <ul className="leyenda" aria-label="Leyenda">
        <li>
          <span className="punto n-urgente" /> Plazo
        </li>
        <li>
          <span className="punto c-citas" /> Cita
        </li>
        <li>
          <span className="punto c-tareas" /> Tarea
        </li>
        <li>
          <span className="rj-of">L</span> Oficina
        </li>
      </ul>
      <DiaLista
        fecha={fecha}
        items={porDia.get(fecha) ?? []}
        hoy={hoy}
        oficina={tareasOficina(tareas, fecha, hoy)}
        festivo={festivos.get(fecha)?.nombre}
        vacio={esDiaVisita(fecha) ? 'Libre para visitas' : 'Nada este día'}
        conMapa
        onNuevo={onNuevo}
      />
    </div>
  )
}

/** AÑO (móvil): 12 meses pequeños; al tocar un día se abre su mes */
export function VistaAnioMano({ fecha, hoy, porDia, festivos, onElegir }: Omit<Comun, 'tareas' | 'onNuevo'> & { fecha: string; onElegir: (f: string) => void }) {
  const anio = fecha.slice(0, 4)
  return (
    <div className="vanio">
      {Array.from({ length: 12 }, (_, m) => {
        const mes = `${anio}-${String(m + 1).padStart(2, '0')}-01`
        const t = nombreMes(mes).replace(/ de \d+$/, '')
        return (
          <section key={mes} className="vanio-mes">
            <h3 className="title-s">{t.charAt(0).toUpperCase() + t.slice(1)}</h3>
            <Rejilla mes={mes} hoy={hoy} porDia={porDia} festivos={festivos} onDia={onElegir} mini />
          </section>
        )
      })}
    </div>
  )
}

