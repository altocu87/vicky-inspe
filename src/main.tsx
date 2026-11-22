import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tabla.css'
import './fichas.css'
import './colores.css'
import './estadisticas.css'
import './calendario.css'
import App from './App.tsx'
import { iniciarTema } from './tema'
import { Consentimiento } from './components/Consentimiento'
import { RUTA_PERMISO } from './lib/oauth'

iniciarTema()

// /oauth/consent: pantalla de permiso para conectar ChatGPT (la abre Supabase). Todo lo demás, la app.
const esPermiso = window.location.pathname === RUTA_PERMISO

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {esPermiso ? <Consentimiento /> : <App />}
  </StrictMode>,
)
