// Pantalla #calendario. Recibe las órdenes YA filtradas con los mismos filtros que la tabla
// (estado, «urgentes», «sin tiempo», búsqueda): un solo estado para las dos vistas.
// Vistas: Plazos, Hoy/Agenda, Día, Semana, Mes y Año. La vista y la fecha van en la URL.
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMobile, usePlazosCtx, usePref } from '../../hooks'
import { addDias, edate, fmt, lunesDe, nombreDia, nombreMes, nombreMesCorto, parse } from '../../lib/fechas'
import { CAPAS, CAPAS_DEF, INFO_CAPA, construirItems, contarCapas, porDia as repartir, sumarMinutos, type Capa, type ItemCal } from '../../lib/capas'
import { eventoNuevo, RE_UUID } from '../../lib/eventos'
import type { Filtros } from '../../lib/filtros'
import type { Festivo } from '../../lib/habiles'
import type { Orden } from '../../lib/ordenes'
import { lineasPlazos } from '../../lib/plazos/lista'
import type { Nivel } from '../../lib/plazos/motor'
import { porProgramar } from '../../lib/porProgramar'
import { desplegar } from '../../lib/repeticion'
import type { Ruta, VistaCal } from '../../lib/ruta'
import { irA } from '../../nav'
import { useAcciones } from '../../state/acciones'
import { useAgenda } from '../../state/agenda'
import { Dialogo } from '../agenda/piezas'
import { PanelPorProgramar } from './PorProgramar'
import { VistaPlazos } from './VistaPlazos'
import { VistaAnioMano, VistaDiaLista, VistaHoy, VistaMesMovil, VistaSemanaLista } from './VistasMano'
import type { Movimiento, VistaFCId } from './VistaFC'

// FullCalendar solo se descarga cuando hace falta (ordenador y vistas Día/Semana/Mes/Año)
const VistaFC = lazy(() => import('./VistaFC'))

const VISTAS: { id: VistaCal; nombre: string; icono: string; tecla: string; soloOrdenador?: boolean }[] = [
  { id: 'plazos', nombre: 'Plazos', icono: 'flag', tecla: 'P' },
  { id: 'hoy', nombre: 'Hoy', icono: 'today', tecla: 'G' },
  { id: 'dia', nombre: 'Día', icono: 'calendar_view_day', tecla: 'D' },
  { id: 'semana', nombre: 'Semana', icono: 'view_week', tecla: 'S' },
  { id: 'mes', nombre: 'Mes', icono: 'calendar_view_month', tecla: 'M' },
  { id: 'anio', nombre: 'Año', icono: 'calendar_today', tecla: 'A' },
]
const TECLAS: Record<string, VistaCal> = { p: 'plazos', g: 'hoy', d: 'dia', s: 'semana', m: 'mes', a: 'anio' }

/** Rango de días que muestra cada vista */
function rango(vista: VistaCal, fecha: string, hoy: string): [string, string] {
  switch (vista) {
    case 'hoy':
      return [hoy, addDias(hoy, 14)]
    case 'dia':
      return [fecha, fecha]
    case 'semana':
      return [lunesDe(fecha), addDias(lunesDe(fecha), 6)]
    case 'mes': {
      const ini = lunesDe(fecha.slice(0, 8) + '01')
      return [ini, addDias(ini, 41)]
    }
    case 'anio':
      return [fecha.slice(0, 4) + '-01-01', fecha.slice(0, 4) + '-12-31']
    default:
      return [hoy, hoy]
  }
}

/** Mover la fecha un periodo adelante (+1) o atrás (-1) */
function mover(vista: VistaCal, fecha: string, n: number): string {
  if (vista === 'dia' || vista === 'hoy') return addDias(fecha, n)
  if (vista === 'semana') return addDias(fecha, 7 * n)
  if (vista === 'mes') return edate(fecha.slice(0, 8) + '01', n)
  if (vista === 'anio') return edate(fecha.slice(0, 5) + '01-01', 12 * n)
  return fecha
}

function tituloVista(vista: VistaCal, fecha: string): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (vista === 'dia') return cap(`${nombreDia(fecha)} ${fmt(fecha)}`)
  if (vista === 'semana') {
    const l = lunesDe(fecha)
    const d = addDias(l, 6)
    return `Semana del ${parse(l).getDate()} ${nombreMesCorto(l)} al ${parse(d).getDate()} ${nombreMesCorto(d)}`
  }
  if (vista === 'mes') return cap(nombreMes(fecha))
  if (vista === 'anio') return fecha.slice(0, 4)
  return ''
}

export function Calendario({
  ordenes,
  todas,
  ruta,
  filtros,
  festivos,
  onOpen,
}: {
  ordenes: Orden[]
  /** Todas las órdenes, sin filtrar: «Ver en el calendario» de una orden la muestra aunque los filtros la oculten */
  todas: Orden[]
  ruta: Ruta
  filtros: Filtros
  festivos: readonly Festivo[]
  onOpen: (o: Orden) => void
}) {
  const mobile = useMobile()
  const ctx = usePlazosCtx()
  const ag = useAgenda()
  const acc = useAcciones()
  const hoy = ctx.hoy
  const [reglasSel, setReglasSel] = usePref<string[]>('cal:reglas', [])
  const [nivelesSel, setNivelesSel] = usePref<Nivel[]>('cal:niveles', [])
  const [capasPref, setCapasPref] = usePref<Capa[]>('cal:capas', [...CAPAS_DEF])
  const [vistaPref, setVistaPref] = usePref<VistaCal>('cal:vista', 'semana')
  const [fechaPref, setFechaPref] = usePref<{ fecha: string; dia: string } | null>('cal:fecha', null)
  const [verPP, setVerPP] = usePref('cal:pp', true)
  const [ppMovil, setPpMovil] = useState(false)
  const [ayuda, setAyuda] = useState(false)
  const [menuMas, setMenuMas] = useState(false)
  const [panelPP, setPanelPP] = useState<HTMLDivElement | null>(null)

  // Vista: la de la URL; si no hay, en el móvil «Hoy» y en el ordenador la última usada
  const vista: VistaCal = ruta.vista ?? (mobile ? 'hoy' : vistaPref)
  // Fecha: la de la URL; si no, la última vista HOY (si era de otro día, se vuelve a hoy)
  const fecha = ruta.fecha ?? (fechaPref && fechaPref.dia === hoy ? fechaPref.fecha : hoy)
  const capas = useMemo(() => new Set(capasPref.filter((c) => (CAPAS as readonly string[]).includes(c))), [capasPref])
  const conFC = !mobile && (vista === 'dia' || vista === 'semana' || vista === 'mes' || vista === 'anio')

  useEffect(() => {
    if (ruta.vista && !mobile) setVistaPref(ruta.vista)
  }, [ruta.vista, mobile, setVistaPref])
  useEffect(() => {
    if (ruta.fecha) setFechaPref({ fecha: ruta.fecha, dia: hoy })
  }, [ruta.fecha, hoy, setFechaPref])

  const ir = useCallback(
    (v: VistaCal, f: string, reemplazar = false) => irA({ pantalla: 'calendario', vista: v, fecha: f, orden: ruta.orden }, reemplazar),
    [ruta.orden],
  )

  // ---- Datos del rango visible (con margen), solo lo necesario ----
  const [desde, hasta] = rango(vista, fecha, hoy)
  const { cargarRango, cargarOrden } = ag
  useEffect(() => {
    if (vista !== 'plazos') cargarRango(desde, hasta)
  }, [vista, desde, hasta, cargarRango])
  const ordenId = ruta.orden
  useEffect(() => {
    if (ordenId) cargarOrden(ordenId)
  }, [ordenId, cargarOrden])

  const todasMap = useMemo(() => new Map(todas.map((o) => [o.id, o])), [todas])
  const visibles = ordenId ? todas : ordenes
  const datos = useMemo(
    () => ({
      ocurrencias: desplegar(ag.eventos, desde, hasta),
      tareas: ag.tareas,
      visibles,
      todas: todasMap,
      festivos,
      tipos: ag.tiposMap,
      ctx,
      filtros,
      ordenId,
    }),
    [ag.eventos, ag.tareas, ag.tiposMap, desde, hasta, visibles, todasMap, festivos, ctx, filtros, ordenId],
  )
  const todosItems = useMemo(() => construirItems(datos, new Set(CAPAS), desde, hasta), [datos, desde, hasta])
  const items = useMemo(() => todosItems.filter((i) => capas.has(i.capa)), [todosItems, capas])
  const cuenta = useMemo(() => contarCapas(todosItems), [todosItems])
  const porDia = useMemo(() => repartir(items, desde, hasta), [items, desde, hasta])
  const pp = useMemo(() => porProgramar(visibles, ag.tareas, ag.conVisita, ctx), [visibles, ag.tareas, ag.conVisita, ctx])
  const atrasadas = useMemo(
    () => (vista === 'hoy' ? construirItems(datos, new Set<Capa>(['tareas']), addDias(hoy, -730), addDias(hoy, -1)).filter((i) => !i.hecho) : []),
    [vista, datos, hoy],
  )
  const vencidos = useMemo(() => (vista === 'hoy' ? lineasPlazos(visibles, ctx, { niveles: ['vencido'], ordenId }).length : 0), [vista, visibles, ctx, ordenId])
  const festMap = ctx.festivos

  // ---- Crear, mover y soltar ----
  const crear = useCallback(
    (f: string) => acc.nuevoEvento({ fecha: f, tipo: 'visita', titulo: '', orden_id: ordenId ?? null }),
    [acc, ordenId],
  )
  async function moverItem(i: ItemCal, m: Movimiento): Promise<boolean> {
    if (i.ref.tipo === 'evento') {
      const e = i.ref.oc.evento
      const r = await ag.actualizarEvento(e.id, {
        fecha: m.fecha,
        fecha_fin: m.hora ? null : m.fecha_fin,
        todo_el_dia: !m.hora,
        hora_inicio: m.hora,
        hora_fin: m.hora ? m.hora_fin : null,
      })
      if (r) acc.avisar(`Movida al ${fmt(m.fecha)}${m.hora ? ' a las ' + m.hora : ''}`)
      return !!r
    }
    if (i.ref.tipo === 'tarea') {
      const t = i.ref.tarea
      const r = await ag.actualizarTarea(t.id, { vence: m.fecha, hora: m.hora, duracion_min: m.hora ? t.duracion_min : null })
      if (r) acc.avisar(`Tarea movida al ${fmt(m.fecha)}`)
      return !!r
    }
    return false
  }
  async function soltar(d: DOMStringMap, m: Movimiento) {
    // Lo que llega del elemento arrastrado se valida antes de usarlo
    const id = d.id ?? ''
    if (!RE_UUID.test(id)) return
    if (d.pp === 'orden' && todasMap.has(id)) {
      const e = await ag.crearEvento(
        eventoNuevo({ fecha: m.fecha, tipo: 'visita', titulo: 'Visita', orden_id: id, todo_el_dia: !m.hora, hora_inicio: m.hora, hora_fin: m.hora ? sumarMinutos(m.hora, 60) : null }),
      )
      if (e) acc.avisar(`Visita creada el ${fmt(m.fecha)}`)
    } else if (d.pp === 'tarea') {
      const t = await ag.actualizarTarea(id, { vence: m.fecha, hora: m.hora })
      if (t) acc.avisar(`Tarea programada el ${fmt(m.fecha)}`)
    }
  }

  // ---- Atajos de teclado (ordenador) ----
  const estado = useRef({ vista, fecha, hoy })
  estado.current = { vista, fecha, hoy }
  useEffect(() => {
    if (mobile) return
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable], dialog')) return
      if (document.querySelector('dialog[open]')) return
      const { vista: v, fecha: f, hoy: h0 } = estado.current
      const k = e.key.toLowerCase()
      if (TECLAS[k]) ir(TECLAS[k], f)
      else if (k === 't') ir(v === 'plazos' ? 'hoy' : v, h0, true)
      else if (k === 'j') ir(v, mover(v, f, 1), true)
      else if (k === 'k') ir(v, mover(v, f, -1), true)
      else if (k === 'n') crear(v === 'hoy' || v === 'plazos' ? h0 : f)
      else if (e.key === '/') document.getElementById('buscar')?.focus()
      else if (e.key === '?') setAyuda(true)
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [mobile, ir, crear])

  // ---- Deslizar el dedo para cambiar de periodo (móvil) ----
  const toque = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    toque.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const t = toque.current
    toque.current = null
    if (!t || vista === 'plazos' || vista === 'hoy') return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(vista, mover(vista, fecha, dx < 0 ? 1 : -1), true)
  }

  const alternarCapa = (c: Capa) => setCapasPref(capas.has(c) ? capasPref.filter((x) => x !== c) : [...capasPref, c])
  const ordenFiltrada = ordenId ? todasMap.get(ordenId) : undefined

  return (
    <div className={`calendario v-${vista}`}>
      <div className="cal-head">
        <div className="seg mini vistas" role="tablist" aria-label="Vista del calendario">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={vista === v.id}
              className={vista === v.id ? 'on' : ''}
              title={`${v.nombre} (${v.tecla})`}
              onClick={() => ir(v.id, v.id === 'hoy' ? hoy : fecha)}
            >
              <span className="icon">{v.icono}</span>
              <span className="vista-txt">{v.nombre}</span>
            </button>
          ))}
        </div>
        {!mobile && (
          <button className="icon-btn" title="Atajos de teclado (?)" aria-label="Atajos de teclado" onClick={() => setAyuda(true)}>
            <span className="icon">keyboard</span>
          </button>
        )}
      </div>

      {ordenId && (
        <div className="filtro-orden" role="status">
          <span className="icon">filter_alt</span>
          <span>
            {ordenFiltrada ? (
              <>
                Solo la orden <strong className="mono">{ordenFiltrada.num_orden}</strong> · {ordenFiltrada.empresa}
              </>
            ) : (
              'No se encuentra esta orden.'
            )}
          </span>
          <button className="btn text sm" onClick={() => irA({ pantalla: 'calendario', vista, fecha }, true)}>
            <span className="icon">close</span>
            Ver todas
          </button>
        </div>
      )}

      {vista === 'plazos' ? (
        <VistaPlazos
          ordenes={visibles}
          ordenId={ordenId}
          reglasSel={reglasSel}
          setReglasSel={setReglasSel}
          nivelesSel={nivelesSel}
          setNivelesSel={setNivelesSel}
          onOpen={onOpen}
          onQuitarOrden={() => irA({ pantalla: 'calendario', vista: 'plazos' }, true)}
          sinFiltroOrden
        />
      ) : (
        <>
          {!ag.disponible && (
            <p className="aviso-caja" role="note">
              <span className="icon">info</span>
              Las visitas y tareas aún no están activadas en la base de datos (falta aplicar la migración de la fase 2). Los plazos y festivos sí se ven.
            </p>
          )}
          <div className="cal-nav">
            {vista !== 'hoy' && (
              <>
                <button className="icon-btn tonal" aria-label="Anterior (K)" title="Anterior (K)" onClick={() => ir(vista, mover(vista, fecha, -1), true)}>
                  <span className="icon">chevron_left</span>
                </button>
                <button className="btn outlined sm" onClick={() => ir(vista, hoy, true)} title="Hoy (T)">
                  Hoy
                </button>
                <button className="icon-btn tonal" aria-label="Siguiente (J)" title="Siguiente (J)" onClick={() => ir(vista, mover(vista, fecha, 1), true)}>
                  <span className="icon">chevron_right</span>
                </button>
                <h2 className="title-l cal-titulo" aria-live="polite">
                  {tituloVista(vista, fecha)}
                </h2>
              </>
            )}
            {vista === 'hoy' && (
              <h2 className="title-l cal-titulo">
                {nombreDia(hoy).charAt(0).toUpperCase() + nombreDia(hoy).slice(1)} {fmt(hoy)}
              </h2>
            )}
            <span className="spacer" />
            {(mobile || !verPP) && (
              <button className="btn tonal sm" onClick={() => (mobile ? setPpMovil(true) : setVerPP(true))} aria-haspopup={mobile ? 'dialog' : undefined}>
                <span className="icon">pending_actions</span>
                Por programar
                <span className="chip-n">{pp.length}</span>
              </button>
            )}
          </div>

          <div className="chips capas" role="group" aria-label="Capas">
            {CAPAS.map((c) => {
              const on = capas.has(c)
              return (
                <button key={c} className={`chip capa c-${c}${on ? ' on' : ''}`} aria-pressed={on} onClick={() => alternarCapa(c)} title={on ? 'Ocultar' : 'Mostrar'}>
                  <span className="capa-color" aria-hidden />
                  <span className="icon">{on ? INFO_CAPA[c].icono : 'visibility_off'}</span>
                  {INFO_CAPA[c].nombre}
                  <span className="chip-n">{cuenta[c]}</span>
                </button>
              )
            })}
          </div>

          <div className={`cal-cuerpo${conFC && verPP ? ' con-pp' : ''}`} onTouchStart={mobile ? onTouchStart : undefined} onTouchEnd={mobile ? onTouchEnd : undefined}>
            <div className="cal-vista">
              {conFC ? (
                <Suspense
                  fallback={
                    <div className="loader">
                      <span />
                    </div>
                  }
                >
                  <VistaFC
                    vista={vista as VistaFCId}
                    fecha={fecha}
                    items={items}
                    festivos={festMap}
                    hoy={hoy}
                    panelPP={panelPP}
                    onItem={acc.verItem}
                    onCrear={(m) =>
                      acc.nuevoEvento({ fecha: m.fecha, fecha_fin: m.fecha_fin, todo_el_dia: !m.hora, hora_inicio: m.hora, hora_fin: m.hora_fin, orden_id: ordenId ?? null })
                    }
                    onMover={moverItem}
                    onSoltar={soltar}
                  />
                </Suspense>
              ) : vista === 'hoy' ? (
                <VistaHoy hoy={hoy} porDia={porDia} tareas={ag.tareas} festivos={festMap} onNuevo={crear} atrasadas={atrasadas} vencidos={vencidos} onVerPlazos={() => ir('plazos', hoy)} />
              ) : vista === 'dia' ? (
                <VistaDiaLista fecha={fecha} hoy={hoy} porDia={porDia} tareas={ag.tareas} festivos={festMap} onNuevo={crear} />
              ) : vista === 'semana' ? (
                <VistaSemanaLista fecha={fecha} hoy={hoy} porDia={porDia} tareas={ag.tareas} festivos={festMap} onNuevo={crear} />
              ) : vista === 'mes' ? (
                <VistaMesMovil fecha={fecha} hoy={hoy} porDia={porDia} tareas={ag.tareas} festivos={festMap} onNuevo={crear} onElegir={(f) => ir('mes', f, true)} />
              ) : (
                <VistaAnioMano fecha={fecha} hoy={hoy} porDia={porDia} festivos={festMap} onElegir={(f) => ir('mes', f)} />
              )}
            </div>
            {conFC && verPP && (
              <aside className="pp-lado" aria-label="Por programar">
                <div className="pp-cab">
                  <h2 className="title-m">
                    Por programar <span className="chip-n">{pp.length}</span>
                  </h2>
                  <button className="icon-btn" aria-label="Ocultar «Por programar»" title="Ocultar" onClick={() => setVerPP(false)}>
                    <span className="icon">close</span>
                  </button>
                </div>
                <PanelPorProgramar ref={setPanelPP} items={pp} arrastrable hoy={hoy} />
              </aside>
            )}
            {!mobile && !conFC && verPP && (
              <aside className="pp-lado" aria-label="Por programar">
                <div className="pp-cab">
                  <h2 className="title-m">
                    Por programar <span className="chip-n">{pp.length}</span>
                  </h2>
                  <button className="icon-btn" aria-label="Ocultar «Por programar»" title="Ocultar" onClick={() => setVerPP(false)}>
                    <span className="icon">close</span>
                  </button>
                </div>
                <PanelPorProgramar items={pp} arrastrable={false} hoy={hoy} />
              </aside>
            )}
          </div>
        </>
      )}

      {ppMovil && (
        <Dialogo hoja titulo={`Por programar (${pp.length})`} onClose={() => setPpMovil(false)}>
          <PanelPorProgramar items={pp} arrastrable={false} hoy={hoy} />
        </Dialogo>
      )}

      {/* Botón «+» (en el móvil, encima de la barra de abajo) */}
      <div className="fab-wrap">
        {menuMas && (
          <div className="fab-menu" role="menu">
            <button role="menuitem" className="btn tonal" onClick={() => (setMenuMas(false), acc.programarVisita(ordenId ?? null, vista === 'hoy' || vista === 'plazos' ? undefined : fecha))}>
              <span className="icon">directions_car</span>
              Visita
            </button>
            <button role="menuitem" className="btn tonal" onClick={() => (setMenuMas(false), acc.nuevoEvento({ fecha: vista === 'hoy' || vista === 'plazos' ? hoy : fecha, tipo: 'comparecencia', orden_id: ordenId ?? null }))}>
              <span className="icon">event</span>
              Otra cita
            </button>
            <button role="menuitem" className="btn tonal" onClick={() => (setMenuMas(false), acc.nuevaTarea({ orden_id: ordenId ?? null }))}>
              <span className="icon">task_alt</span>
              Tarea
            </button>
          </div>
        )}
        <button className="fab" aria-expanded={menuMas} aria-haspopup="menu" aria-label="Añadir" onClick={() => setMenuMas((v) => !v)}>
          <span className="icon">{menuMas ? 'close' : 'add'}</span>
          <span className="fab-label">Añadir</span>
        </button>
      </div>

      {ayuda && (
        <Dialogo pequeno titulo="Atajos de teclado" onClose={() => setAyuda(false)}>
          <dl className="atajos">
            {VISTAS.map((v) => (
              <div key={v.id}>
                <dt>
                  <kbd>{v.tecla}</kbd>
                </dt>
                <dd>Vista {v.nombre}</dd>
              </div>
            ))}
            <div>
              <dt>
                <kbd>T</kbd>
              </dt>
              <dd>Ir a hoy</dd>
            </div>
            <div>
              <dt>
                <kbd>J</kbd> / <kbd>K</kbd>
              </dt>
              <dd>Siguiente / anterior</dd>
            </div>
            <div>
              <dt>
                <kbd>N</kbd>
              </dt>
              <dd>Nueva cita</dd>
            </div>
            <div>
              <dt>
                <kbd>/</kbd>
              </dt>
              <dd>Buscar</dd>
            </div>
            <div>
              <dt>
                <kbd>?</kbd>
              </dt>
              <dd>Esta ayuda</dd>
            </div>
          </dl>
          <p className="body-m muted">También puedes crear arrastrando sobre un hueco, mover las citas arrastrándolas y estirarlas por el borde.</p>
        </Dialogo>
      )}
    </div>
  )
}
