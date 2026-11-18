import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ver, setVer] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) setError('Correo o contraseña incorrectos.')
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={entrar}>
        <div className="brand-mark">
          <span className="icon fill">fact_check</span>
        </div>
        <div>
          <h1 className="headline">Inspecciones</h1>
          <p className="body-m muted" style={{ margin: '4px 0 0' }}>
            Seguimiento de órdenes, visitas y plazos
          </p>
        </div>
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
