import { useState } from 'react'
import { api } from '../data/api'
import { Logo } from './Logo'

/** `aviso`: texto opcional encima del formulario (por ejemplo, al conectar ChatGPT) */
export function Login({ aviso }: { aviso?: string } = {}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ver, setVer] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const error = await (await api()).entrar(email.trim(), password)
      if (error) setError(error + '.')
    } catch {
      setError('No hay conexión con el servidor. Comprueba internet e inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={entrar}>
        <Logo size={88} />
        <div>
          <h1 className="headline">Inspecciones</h1>
          <p className="body-m muted" style={{ margin: '4px 0 0' }}>
            Seguimiento de órdenes, visitas y plazos
          </p>
        </div>
        {aviso && (
          <p className="aviso-login" role="note">
            <span className="icon">smart_toy</span>
            <span className="body-m">{aviso}</span>
          </p>
        )}
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className={`field${error ? ' error' : ''}`}>
          <label htmlFor="pass">Contraseña</label>
          <input
            id="pass"
            type={ver ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ paddingRight: 52 }}
          />
          <button
            type="button"
            className="icon-btn"
            style={{ position: 'absolute', right: 6, top: 7 }}
            onClick={() => setVer((v) => !v)}
            aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            <span className="icon">{ver ? 'visibility_off' : 'visibility'}</span>
          </button>
          {error && <span className="help">{error}</span>}
        </div>
        <button className="btn filled lg" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
          <span className="icon">arrow_forward</span>
        </button>
      </form>
    </main>
  )
}
