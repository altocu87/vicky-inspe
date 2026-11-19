// Navegar entre pantallas cambiando el «#» de la dirección (el botón Atrás funciona).
import { hashDe, type Ruta } from './lib/ruta'

export function irA(r: Ruta, reemplazar = false) {
  const h = hashDe(r)
  const url = h || window.location.pathname + window.location.search
  if (reemplazar) window.history.replaceState(null, '', url)
  else window.history.pushState(null, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
