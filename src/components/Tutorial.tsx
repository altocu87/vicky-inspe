// Tutorial interactivo («?» arriba): va señalando cada parte de la página con un foco
// y una tarjeta de explicación. Funciona en el móvil y en el ordenador; se cierra con Esc
// y se avanza con las flechas. No cambia ningún dato: solo cambia de pantalla.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMobile } from '../hooks'
import { irA } from '../nav'
import type { Ruta } from '../lib/ruta'

interface Paso {
  /** Pantalla en la que tiene que estar */
  pantalla?: 'lista' | 'calendario'
  /** Elemento a señalar: [data-tour="…"] (si no está, la tarjeta sale en el centro) */
  objetivo?: string
  titulo: string
  texto: string
  /** Texto distinto para el móvil */
  textoMovil?: string
}

const PASOS: Paso[] = [
  {
    titulo: '¡Hola! Te enseño la app',
    texto: 'En un minuto verás dónde está cada cosa. Pulsa «Siguiente» (o la flecha →) para avanzar. Puedes cerrarlo cuando quieras y repetirlo con el botón «?».',
  },
  {
    pantalla: 'lista',
    objetivo: 'totales',
    titulo: 'Totales y filtros rápidos',
    texto: 'Cuántas órdenes hay En curso, Pte. entrega y Devueltas, y cuántas tienen un plazo a menos de 30 días o ya vencido. Pulsa una tarjeta para ver solo esas; vuelve a pulsarla para quitar el filtro.',
    textoMovil: 'Cuántas órdenes hay en cada estado y cuántas tienen prisa. Desliza a los lados para ver todas y pulsa una para filtrar.',
  },
  {
    pantalla: 'lista',
    objetivo: 'buscar',
    titulo: 'Buscar',
    texto: 'Busca por nº de orden, empresa, objeto o tareas. La búsqueda y los filtros valen también para el calendario. Atajo: tecla «/».',
    textoMovil: 'Con la lupa buscas por nº de orden, empresa u objeto. La búsqueda vale también para el calendario.',
  },
  {
    pantalla: 'lista',
    objetivo: 'lista',
    titulo: 'Tus órdenes',
    texto: 'Cada fila muestra sus plazos con colores (rojo = vencido o menos de 30 días) y la próxima visita. Pulsa una orden para abrirla: verás sus datos, su agenda (visitas y tareas) y su historial con todo lo que ha pasado.',
    textoMovil: 'Cada orden con sus plazos de colores y la próxima visita. Tócala para abrirla: datos, agenda (visitas y tareas) e historial.',
  },
  {
    pantalla: 'lista',
    objetivo: 'programar',
    titulo: 'Programar una visita',
    texto: 'Este botón crea una visita para esa orden y te propone el próximo domingo o lunes libre. El icono de al lado la abre en el calendario.',
  },
  {
    pantalla: 'lista',
    objetivo: 'nueva',
    titulo: 'Nueva orden',
    texto: 'Para dar de alta una orden nueva.',
  },
  {
    pantalla: 'lista',
    objetivo: 'nav-cal',
    titulo: 'Calendario',
    texto: 'Aquí pasas de las órdenes al calendario. Vamos a verlo.',
  },
  {
    pantalla: 'calendario',
    objetivo: 'vistas',
    titulo: 'Vistas del calendario',
    texto: 'Plazos (todas las fechas límite), Hoy (lo de hoy y los próximos días), Día, Semana, Mes y Año. El lunes sale como «Oficina» y el domingo y el lunes resaltados como días de visita. Atajos: P, G, D, S, M, A; T = hoy; J/K = adelante/atrás.',
    textoMovil: 'Plazos, Hoy, Día, Semana, Mes y Año. En Día, Semana, Mes y Año desliza el dedo a los lados para cambiar de periodo.',
  },
  {
    pantalla: 'calendario',
    objetivo: 'capas',
    titulo: 'Capas',
    texto: 'Enciende o apaga lo que quieres ver: Plazos, Visitas y citas, Tareas, Hitos de la orden y Festivos. El número es cuántos hay en lo que estás viendo.',
  },
  {
    pantalla: 'calendario',
    objetivo: 'porprogramar',
    titulo: 'Por programar',
    texto: 'Órdenes con un plazo a menos de 30 días que aún no tienen visita, y tareas sin fecha. En el ordenador puedes arrastrarlas a un día del calendario; o pulsa «Programar».',
    textoMovil: 'Órdenes con prisa que aún no tienen visita, y tareas sin fecha. Pulsa «Programar» para darles día.',
  },
  {
    pantalla: 'calendario',
    objetivo: 'contenido',
    titulo: 'Tus visitas',
    texto: 'Pulsa una visita para ver su ficha: «Cómo llegar», «Llamar», y «Hecha» o «Fallida». Al marcarla podrás escribir los detalles de la visita y, si quieres, actualizar la orden (última actuación y estado de la visita). En el ordenador también puedes arrastrar las citas para cambiarlas de día u hora, y crear una arrastrando sobre un hueco.',
    textoMovil: 'Toca una visita para ver su ficha: «Cómo llegar», «Llamar», y «Hecha» o «Fallida». Al marcarla puedes apuntar los detalles y actualizar la orden.',
  },
  {
    pantalla: 'calendario',
    objetivo: 'anadir',
    titulo: 'Añadir',
    texto: 'Para crear una visita, otra cita (comparecencia…) o una tarea. Las tareas pueden ser «para la oficina»: salen el lunes.',
  },
  {
    objetivo: 'ajustes',
    titulo: 'Ajustes',
    texto: 'Festivos de Albacete, reglas de plazo y tipos de cita.',
  },
  {
    objetivo: 'ayuda',
    titulo: '¡Listo!',
    texto: 'Cuando quieras repasar algo, pulsa este «?». Los datos no se han tocado durante el tutorial.',
  },
]

/** Espera a que aparezca el elemento (al cambiar de pantalla tarda un poco) */
function buscar(objetivo: string, ms = 2500): Promise<HTMLElement | null> {
  const sel = `[data-tour="${objetivo}"]`
  return new Promise((resolver) => {
    const fin = Date.now() + ms
    const mirar = () => {
      const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.getClientRects().length > 0)
      if (el || Date.now() > fin) return resolver(el ?? null)
      requestAnimationFrame(mirar)
    }
    mirar()
  })
}

export function Tutorial({ ruta, onClose }: { ruta: Ruta; onClose: () => void }) {
  const mobile = useMobile()
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [listo, setListo] = useState(false)
  const elRef = useRef<HTMLElement | null>(null)
  const tarjeta = useRef<HTMLDivElement>(null)
  const paso = PASOS[i]

  // Ir a la pantalla del paso y buscar su elemento
  useEffect(() => {
    let vivo = true
    setListo(false)
    if (paso.pantalla === 'lista' && ruta.pantalla !== 'lista') irA({ pantalla: 'lista' })
    if (paso.pantalla === 'calendario' && (ruta.pantalla !== 'calendario' || ruta.vista === 'plazos' || !ruta.vista))
      irA({ pantalla: 'calendario', vista: 'hoy' })
    ;(async () => {
      const el = paso.objetivo ? await buscar(paso.objetivo) : null
      if (!vivo) return
      elRef.current = el
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      // Tras el desplazamiento, medir
      setTimeout(() => {
        if (!vivo) return
        setRect(el ? el.getBoundingClientRect() : null)
        setListo(true)
      }, el ? 350 : 0)
    })()
    return () => {
      vivo = false
    }
    // Solo al cambiar de paso (la ruta cambia porque la cambiamos nosotros)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Seguir al elemento si se desplaza la página o cambia el tamaño
  useLayoutEffect(() => {
    const medir = () => setRect(elRef.current ? elRef.current.getBoundingClientRect() : null)
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [])

  const siguiente = useCallback(() => (i < PASOS.length - 1 ? setI(i + 1) : onClose()), [i, onClose])
  const anterior = useCallback(() => i > 0 && setI(i - 1), [i])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') siguiente()
      else if (e.key === 'ArrowLeft') anterior()
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('keydown', h, true)
    return () => document.removeEventListener('keydown', h, true)
  }, [siguiente, anterior, onClose])

  useEffect(() => {
    if (listo) tarjeta.current?.focus()
  }, [listo, i])

  // La tarjeta va arriba si lo señalado está en la mitad de abajo, y abajo si no
  const arriba = rect ? rect.top + rect.height / 2 > window.innerHeight / 2 : false
  const M = 6
  return (
    <div className="tour" role="presentation">
      {rect && listo ? (
        <div
          className="tour-foco"
          style={{ top: rect.top - M, left: rect.left - M, width: rect.width + 2 * M, height: rect.height + 2 * M }}
          aria-hidden
        />
      ) : (
        <div className="tour-fondo" aria-hidden />
      )}
      <div
        ref={tarjeta}
        className={`tour-tarjeta${rect ? (arriba ? ' arriba' : ' abajo') : ' centro'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-tit"
        aria-describedby="tour-txt"
        tabIndex={-1}
      >
        <p className="tour-paso label-m">
          Paso {i + 1} de {PASOS.length}
        </p>
        <h2 id="tour-tit" className="title-l">
          {paso.titulo}
        </h2>
        <p id="tour-txt" className="body-m">
          {mobile && paso.textoMovil ? paso.textoMovil : paso.texto}
        </p>
        <div className="tour-puntos" aria-hidden>
          {PASOS.map((_, n) => (
            <span key={n} className={n === i ? 'on' : ''} />
          ))}
        </div>
        <div className="tour-botones">
          <button className="btn text" onClick={onClose}>
            Salir
          </button>
          <span className="spacer" />
          {i > 0 && (
            <button className="btn tonal" onClick={anterior} aria-label="Paso anterior">
              <span className="icon">arrow_back</span>
            </button>
          )}
          <button className="btn filled" onClick={siguiente}>
            {i < PASOS.length - 1 ? 'Siguiente' : 'Terminar'}
            <span className="icon">{i < PASOS.length - 1 ? 'arrow_forward' : 'check'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
