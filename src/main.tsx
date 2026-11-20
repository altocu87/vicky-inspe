import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tabla.css'
import './colores.css'
import './estadisticas.css'
import './calendario.css'
import App from './App.tsx'
import { iniciarTema } from './tema'

iniciarTema()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
