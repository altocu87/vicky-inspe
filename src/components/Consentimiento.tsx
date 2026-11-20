// Pantalla de permiso para conectar ChatGPT (vicky-inspe.vercel.app/oauth/consent).
// Supabase manda aquí cuando ChatGPT pide acceso. Hay que entrar con el usuario de la app y pulsar «Permitir».
// Se acepta UNA vez: si ya se dio permiso, vuelve a ChatGPT sola, sin preguntar.
// Solo se puede volver a ChatGPT (chatgpt.com): cualquier otro programa se rechaza.
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { api, type DetallesPermiso } from '../data/api'
import { leerAuthorizationId, vueltaPermitida } from '../lib/oauth'
import { Login } from './Login'
import { Logo } from './Logo'

const DESARROLLO = import.meta.env.DEV

type Estado =
  | { fase: 'cargando' }
  | { fase: 'pedir'; d: Extract<DetallesPermiso, { tipo: 'pedir' }> }
  | { fase: 'volviendo' }
  | { fase: 'error'; mensaje: string }

function volver(url: string) {
  // Solo a ChatGPT (doble comprobación: aquí y al leer los detalles)
  if (vueltaPermitida(url, DESARROLLO)) window.location.replace(url)
}

export function Consentimiento() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const authId = leerAuthorizationId(window.location.search)

  useEffect(() => {
    let quitar = () => {}
    let vivo = true
    api().then(async (b) => {
      const s = await b.sesion()
      if (!vivo) return
      setSession(s)
      quitar = b.alCambiarSesion(setSession)
    })
    return () => {
      vivo = false
      quitar()
    }
  }, [])

  if (session === undefined)
    return (
      <div className="loader">
        <span />
      </div>
    )
  if (!authId) return <Tarjeta icono="link_off" titulo="Enlace no válido" texto="Esta página se abre sola cuando conectas ChatGPT con la app. Vuelve a ChatGPT y conecta otra vez." />
  if (!session) return <Login aviso="ChatGPT quiere conectarse con tu app. Entra con tu usuario para decidir si le das permiso." />
  return <Pedir authId={authId} email={session.user.email ?? ''} />
}

function Pedir({ authId, email }: { authId: string; email: string }) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const b = await api()
      const r = await b.oauthDetalles(authId)
      if (!vivo) return
      if (r.error !== null) return setEstado({ fase: 'error', mensaje: r.error })
      const d = r.data
      if (d.tipo === 'volver') {
        // Ya habías dado permiso antes: se vuelve a ChatGPT sin preguntar
        if (!vueltaPermitida(d.url, DESARROLLO)) return setEstado({ fase: 'error', mensaje: 'La conexión no es de ChatGPT. No se ha dado acceso.' })
        setEstado({ fase: 'volviendo' })
        return volver(d.url)
      }
      if (!vueltaPermitida(d.redirectUri, DESARROLLO)) {
        // Un programa que no es ChatGPT: se rechaza directamente (sin mandar a ningún sitio)
        await b.oauthDecidir(authId, false)
        return setEstado({ fase: 'error', mensaje: `«${d.cliente}» no es ChatGPT. Por seguridad, solo se puede conectar ChatGPT. No se ha dado acceso.` })
      }
      setEstado({ fase: 'pedir', d })
    })()
    return () => {
      vivo = false
    }
  }, [authId])

  async function decidir(permitir: boolean) {
    setEnviando(true)
    const r = await (await api()).oauthDecidir(authId, permitir)
    setEnviando(false)
    if (r.error !== null) return setEstado({ fase: 'error', mensaje: r.error })
    setEstado({ fase: 'volviendo' })
    volver(r.data)
  }

  if (estado.fase === 'cargando' || estado.fase === 'volviendo')
    return (
      <main className="login">
        <div className="login-card permiso" aria-busy="true">
          <Logo size={72} />
          <p className="title-m" role="status">
            {estado.fase === 'volviendo' ? 'Volviendo a ChatGPT…' : 'Comprobando la solicitud…'}
          </p>
        </div>
      </main>
    )
  if (estado.fase === 'error') return <Tarjeta icono="gpp_bad" titulo="No se ha conectado" texto={estado.mensaje} />

  const { d } = estado
  return (
    <main className="login">
      <section className="login-card permiso" aria-labelledby="permiso-titulo">
        <div className="permiso-cab">
          <Logo size={64} />
          <span className="icon permiso-enlace" aria-hidden="true">
            sync_alt
          </span>
          <span className="permiso-ia" aria-hidden="true">
            <span className="icon">smart_toy</span>
          </span>
        </div>
        <div>
          <h1 id="permiso-titulo" className="headline">
            Conectar {d.cliente}
          </h1>
          <p className="body-m muted" style={{ margin: '4px 0 0' }}>
            Con tu usuario <strong>{d.email || email}</strong>
          </p>
        </div>

        <ul className="permiso-lista">
          <li>
            <span className="icon ok">visibility</span>
            <span>Consultar tus órdenes, plazos, agenda, historial e informes.</span>
          </li>
          <li>
            <span className="icon ok">edit_calendar</span>
            <span>Crear y cambiar órdenes, visitas y tareas. ChatGPT te pedirá confirmación antes de cada cambio.</span>
          </li>
          <li>
            <span className="icon ko">block</span>
            <span>
              <strong>Nunca</strong> podrá borrar nada ni tocar los Ajustes.
            </span>
          </li>
        </ul>

        <p className="aviso-caja" role="note">
          <span className="icon">info</span>
          <span>Lo que consultes desde ChatGPT se envía a OpenAI. Por defecto solo salen nº de orden, empresa, fechas y estado; las notas, solo si las pides.</span>
        </p>
        <p className="body-m muted" style={{ margin: 0 }}>
          Solo hace falta aceptarlo una vez. Puedes quitar el acceso cuando quieras en <strong>Ajustes → Asistentes conectados</strong>.
        </p>

        <button className="btn filled lg" disabled={enviando} onClick={() => decidir(true)}>
          <span className="icon">check</span>
          {enviando ? 'Guardando…' : 'Permitir'}
        </button>
        <button className="btn outlined" disabled={enviando} onClick={() => decidir(false)}>
          No permitir
        </button>
      </section>
    </main>
  )
}

function Tarjeta({ icono, titulo, texto }: { icono: string; titulo: string; texto: string }) {
  return (
    <main className="login">
      <section className="login-card permiso" aria-labelledby="permiso-titulo">
        <Logo size={72} />
        <div>
          <h1 id="permiso-titulo" className="headline">
            <span className="icon" aria-hidden="true" style={{ verticalAlign: '-4px', marginRight: 8 }}>
              {icono}
            </span>
            {titulo}
          </h1>
          <p className="body-m muted" style={{ margin: '8px 0 0' }}>
            {texto}
          </p>
        </div>
        <a className="btn tonal" href="/">
          <span className="icon">home</span>
          Ir a la app
        </a>
      </section>
    </main>
  )
}
