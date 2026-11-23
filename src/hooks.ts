// Hooks compartidos por varias pantallas.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { hoyIso } from './lib/fechas'
import { contextoBase, type ContextoPlazos } from './lib/plazos/motor'

/** Preferencias del usuario en este navegador (solo ajustes de pantalla, nunca datos) */
export function usePref<T>(key: string, def: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('vi:' + key)
      return raw ? (JSON.parse(raw) as T) : def
    } catch {
      return def
    }
  })
  const set = useCallback(
    (nv: T) => {
      setV(nv)
      try {
        localStorage.setItem('vi:' + key, JSON.stringify(nv))
      } catch {
        /* sin almacenamiento */
      }
    },
    [key],
  )
  return [v, set]
}

export function useMobile() {
  const q = '(max-width: 720px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const h = () => setM(mq.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

/** Contexto de plazos (hoy, reglas y festivos) compartido por todas las pantallas */
export const PlazosCtx = createContext<ContextoPlazos>(contextoBase(hoyIso()))
export const usePlazosCtx = () => useContext(PlazosCtx)

/**
 * Devuelve siempre el mismo valor mientras su «clave» no cambie, aunque llegue un objeto nuevo.
 * Sirve para no recalcular todo lo que depende de él cuando el contenido es el mismo.
 */
export function useEstable<T>(valor: T, clave: string): T {
  const ref = useRef({ clave, valor })
  if (ref.current.clave !== clave) ref.current = { clave, valor }
  return ref.current.valor
}
