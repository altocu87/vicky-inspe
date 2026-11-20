// Tema de la app: automático (sigue al sistema), claro u oscuro.
// Se guarda en este navegador y se aplica con el atributo data-tema de <html>.
import { useSyncExternalStore } from 'react'

export type Tema = 'auto' | 'claro' | 'oscuro'
export const TEMAS: Tema[] = ['auto', 'claro', 'oscuro']
export const NOMBRE_TEMA: Record<Tema, string> = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' }
export const ICONO_TEMA: Record<Tema, string> = { auto: 'brightness_auto', claro: 'light_mode', oscuro: 'dark_mode' }

const CLAVE = 'vi:tema'
const mq = window.matchMedia('(prefers-color-scheme: dark)')
const oyentes = new Set<() => void>()

function leer(): Tema {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? '"auto"')
    return TEMAS.includes(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

let actual: Tema = leer()

function aplicar() {
  const oscuro = actual === 'oscuro' || (actual === 'auto' && mq.matches)
  document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#121318' : '#FBF8FF')
}

export function iniciarTema() {
  aplicar()
  mq.addEventListener('change', aplicar) // en "automático" sigue los cambios del sistema
}

export function setTema(t: Tema) {
  actual = t
  try {
    localStorage.setItem(CLAVE, JSON.stringify(t))
  } catch {
    /* sin almacenamiento */
  }
  aplicar()
  oyentes.forEach((f) => f())
}

export function useTema(): [Tema, (t: Tema) => void] {
  const t = useSyncExternalStore(
    (f) => {
      oyentes.add(f)
      return () => oyentes.delete(f)
    },
    () => actual,
  )
  return [t, setTema]
}
