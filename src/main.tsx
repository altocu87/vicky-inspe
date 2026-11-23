import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tabla.css'
import './fichas.css'
import './colores.css'
import './estadisticas.css'
import './calendario.css'
import App from './App.tsx'
import { iniciarTema } from './tema'
import { RUTA_PERMISO } from './lib/oauth'
import { ErrorBoundary } from './components/ErrorBoundary'
import { vigilarVersionNueva } from './lib/recarga'

iniciarTema()
// Tras publicar una versión nueva, si falta un archivo antiguo, recarga (sin bucles)
vigilarVersionNueva()

// /oauth/consent: pantalla de permiso para conectar ChatGPT (la abre Supabase). Todo lo demás, la app.
const esPermiso = window.location.pathname === RUTA_PERMISO
// Solo se descarga si se abre esa pantalla
const Consentimiento = lazy(() => import('./components/Consentimiento').then((m) => ({ default: m.Consentimiento })))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {esPermiso ? (
        <Suspense
          fallback={
            <div className="loader">
              <span />
            </div>
          }
        >
          <Consentimiento />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
)
