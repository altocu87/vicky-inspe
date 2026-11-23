// Red de seguridad de toda la app: si algo falla al pintar la pantalla, en vez de quedarse
// en blanco se enseña un aviso con un botón para recargar.
// Si el fallo es por una versión nueva publicada (faltan archivos antiguos), recarga sola una vez.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { esErrorDeCarga, recargarSiSePuede } from '../lib/recarga'

type Estado = { error: unknown; recargando: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null, recargando: false }

  static getDerivedStateFromError(error: unknown): Partial<Estado> {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Error en la app:', error, info.componentStack)
    if (esErrorDeCarga(error) && recargarSiSePuede()) this.setState({ recargando: true })
  }

  render() {
    if (!this.state.error) return this.props.children
    const nueva = esErrorDeCarga(this.state.error)
    return (
      <main className="login">
        <div className="login-card error-app" role="alert">
          <span className="error-app-icono" aria-hidden>
            <span className="icon">{nueva ? 'update' : 'error'}</span>
          </span>
          <div>
            <h1 className="headline">{nueva ? 'Hay una versión nueva' : 'Algo ha fallado'}</h1>
            <p className="body-m muted" style={{ margin: '8px 0 0' }}>
              {this.state.recargando
                ? 'Recargando…'
                : nueva
                  ? 'La app se ha actualizado mientras la tenías abierta. Recarga la página para seguir.'
                  : 'No se ha podido mostrar esta pantalla. Tus datos están guardados: recarga la página para seguir.'}
            </p>
          </div>
          <button type="button" className="btn filled lg" onClick={() => window.location.reload()} disabled={this.state.recargando}>
            <span className="icon">refresh</span>
            Recargar
          </button>
        </div>
      </main>
    )
  }
}
