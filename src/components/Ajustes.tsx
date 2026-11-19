// Pantalla #ajustes: festivos (para días hábiles) y reglas de plazo.
import { useEffect, useRef, useState } from 'react'
import { api } from '../data/api'
import { esIso, fmt, hoyIso, nombreDia } from '../lib/fechas'
import type { Ambito, Festivo } from '../lib/habiles'
import { ESTADOS, LABELS } from '../lib/ordenes'
import { CAMPOS_PARTIDA, describirRegla, NOMBRE_CAMPO, NOMBRE_UNIDAD, UNIDADES, type CampoPartida, type Regla, type Unidad } from '../lib/plazos/reglas'

const NOMBRE_AMBITO: Record<Ambito, string> = { nacional: 'Nacional', autonomico: 'Castilla-La Mancha', local: 'Local (Albacete)' }

function idAleatorio() {
  const a = new Uint8Array(6)
  crypto.getRandomValues(a)
  return 'r_' + [...a].map((b) => (b % 36).toString(36)).join('')
}

export function Ajustes({
  festivos,
  reglas,
  onBack,
  onCambio,
  avisar,
}: {
  festivos: Festivo[]
  reglas: Regla[]
  onBack: () => void
  onCambio: () => void
  avisar: (msg: string, err?: boolean) => void
}) {
  const anioHoy = Number(hoyIso().slice(0, 4))
  const anios = [...new Set([anioHoy, anioHoy + 1, ...festivos.map((f) => Number(f.fecha.slice(0, 4)))])].sort()
  const [anio, setAnio] = useState(anioHoy + (Number(hoyIso().slice(5, 7)) >= 10 ? 1 : 0))
  const delAnio = festivos.filter((f) => f.fecha.startsWith(String(anio)))
  const locales = delAnio.filter((f) => f.ambito === 'local').length

  return (
    <div className="app ajustes">
      <header className="topbar">
        <button className="icon-btn tonal" onClick={onBack} aria-label="Volver">
          <span className="icon">arrow_back</span>
        </button>
        <span className="title-l">Ajustes</span>
      </header>

      <section className="section aj-sec" aria-labelledby="aj-fest">
        <div className="section-title">
          <span className="icon">celebration</span>
          <h2 id="aj-fest" className="title-m">
            Festivos de Albacete
          </h2>
        </div>
        <p className="body-m muted">
          Se usan para contar los días hábiles y para avisar cuando un plazo cae en festivo. Los de cada año salen del BOE, del DOCM y del boletín de la
          provincia de Albacete.
        </p>
        <div className="seg mini" role="radiogroup" aria-label="Año">
          {anios.map((a) => (
            <button key={a} role="radio" aria-checked={a === anio} className={a === anio ? 'on' : ''} onClick={() => setAnio(a)}>
              {a}
            </button>
          ))}
        </div>
        {locales < 2 && (
          <p className="aviso-caja" role="note">
            <span className="icon">info</span>
            Faltan las fiestas locales de Albacete de {anio} ({locales} de 2). Añádelas cuando se publiquen.
          </p>
        )}
        <ul className="aj-lista">
          {delAnio.length === 0 && <li className="body-m muted">No hay festivos guardados para {anio}.</li>}
          {delAnio.map((f) => (
            <FilaFestivo key={f.fecha} f={f} onCambio={onCambio} avisar={avisar} />
          ))}
        </ul>
        <NuevoFestivo anio={anio} existentes={festivos} onCambio={onCambio} avisar={avisar} />
      </section>

      <section className="section aj-sec" aria-labelledby="aj-reglas">
        <div className="section-title">
          <span className="icon">rule</span>
          <h2 id="aj-reglas" className="title-m">
            Reglas de plazo
          </h2>
        </div>
        <p className="body-m muted">Cada regla calcula una fecha límite para las órdenes. Las dos del Excel no se pueden borrar, pero sí desactivar.</p>
        <ul className="aj-lista">
          {reglas.map((r) => (
            <FilaRegla key={r.id} r={r} todas={reglas} onCambio={onCambio} avisar={avisar} />
          ))}
        </ul>
        <NuevaRegla reglas={reglas} onCambio={onCambio} avisar={avisar} />
      </section>
    </div>
  )
}

function FilaFestivo({ f, onCambio, avisar }: { f: Festivo; onCambio: () => void; avisar: (m: string, e?: boolean) => void }) {
  const [borrando, setBorrando] = useState(false)
  return (
    <li className="aj-fila">
      <span className="aj-fecha">
        <strong>{fmt(f.fecha)}</strong>
        <span className="muted"> · {nombreDia(f.fecha)}</span>
      </span>
      <span className="aj-txt">
        {f.nombre}
        <span className={`tag amb-${f.ambito}`}>{NOMBRE_AMBITO[f.ambito]}</span>
      </span>
      <button
        className="icon-btn"
        aria-label={`Quitar el festivo ${f.nombre} del ${fmt(f.fecha)}`}
        title="Quitar"
        disabled={borrando}
        onClick={async () => {
          if (!window.confirm(`¿Quitar «${f.nombre}» (${fmt(f.fecha)})?`)) return
          setBorrando(true)
          const err = await (await api()).eliminarFestivo(f.fecha)
          setBorrando(false)
          if (err) return avisar('No se pudo quitar: ' + err, true)
          avisar('Festivo quitado')
          onCambio()
        }}
      >
        <span className="icon">delete</span>
      </button>
    </li>
  )
}

function NuevoFestivo({
  anio,
  existentes,
  onCambio,
  avisar,
}: {
  anio: number
  existentes: Festivo[]
  onCambio: () => void
  avisar: (m: string, e?: boolean) => void
}) {
  const [fecha, setFecha] = useState('')
  const [nombre, setNombre] = useState('')
  const [ambito, setAmbito] = useState<Ambito>('local')
  const [guardando, setGuardando] = useState(false)
  const fechaRef = useRef<HTMLInputElement>(null)
  useEffect(() => setFecha(''), [anio])
  const repetido = existentes.some((f) => f.fecha === fecha)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const n = nombre.trim()
    if (!esIso(fecha) || !n || n.length > 120) return avisar('Indica la fecha y el nombre del festivo', true)
    if (repetido) return avisar('Ese día ya es festivo', true)
    setGuardando(true)
    const err = await (await api()).guardarFestivo({ fecha, nombre: n, ambito, fuente: 'Añadido en Ajustes' })
    setGuardando(false)
    if (err) return avisar('No se pudo guardar: ' + err, true)
    setFecha('')
    setNombre('')
    avisar('Festivo añadido')
    onCambio()
    fechaRef.current?.focus()
  }

  return (
    <form className="aj-form" onSubmit={guardar}>
      <h3 className="title-s">Añadir festivo</h3>
      <div className="fields three">
        <div className={`field${repetido ? ' error' : ''}`}>
          <label htmlFor="nf-fecha">Fecha</label>
          <input
            id="nf-fecha"
            ref={fechaRef}
            type="date"
            value={fecha}
            min={`${anio}-01-01`}
            max={`${anio}-12-31`}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
          {repetido && <span className="help">Ese día ya está en la lista</span>}
        </div>
        <div className="field">
          <label htmlFor="nf-nombre">Nombre</label>
          <input id="nf-nombre" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} placeholder="Ej.: Fiesta local" required />
        </div>
        <div className="field">
          <label htmlFor="nf-amb">Ámbito</label>
          <select id="nf-amb" value={ambito} onChange={(e) => setAmbito(e.target.value as Ambito)}>
            {(Object.keys(NOMBRE_AMBITO) as Ambito[]).map((a) => (
              <option key={a} value={a}>
                {NOMBRE_AMBITO[a]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className="btn tonal" disabled={guardando}>
        <span className="icon">add</span>
        Añadir
      </button>
    </form>
  )
}

function FilaRegla({ r, todas, onCambio, avisar }: { r: Regla; todas: Regla[]; onCambio: () => void; avisar: (m: string, e?: boolean) => void }) {
  const [ocupado, setOcupado] = useState(false)
  async function alternar() {
    setOcupado(true)
    const err = await (await api()).activarRegla(r.id, r.base, !r.activa)
    setOcupado(false)
    if (err) return avisar('No se pudo cambiar: ' + err, true)
    onCambio()
  }
  async function borrar() {
    if (!window.confirm(`¿Borrar la regla «${r.nombre}»? Sus fechas dejarán de calcularse.`)) return
    setOcupado(true)
    const err = await (await api()).eliminarRegla(r.id)
    setOcupado(false)
    if (err) return avisar('No se pudo borrar: ' + err, true)
    avisar('Regla borrada')
    onCambio()
  }
  return (
    <li className={`aj-fila${r.activa ? '' : ' off'}`}>
      <span className="aj-txt">
        <strong>{r.nombre}</strong>
        {r.base && <span className="tag">Del Excel</span>}
        <span className="body-m muted aj-desc">{describirRegla(r, todas)}</span>
      </span>
      <label className="switch" title={r.activa ? 'Activa' : 'Desactivada'}>
        <input type="checkbox" role="switch" checked={r.activa} disabled={ocupado} onChange={alternar} aria-label={`Regla ${r.nombre} activa`} />
        <span className="track">
          <span className="thumb">
            <span className="icon">{r.activa ? 'check' : 'close'}</span>
          </span>
        </span>
      </label>
      {!r.base && (
        <button className="icon-btn" aria-label={`Borrar la regla ${r.nombre}`} title="Borrar" disabled={ocupado} onClick={borrar}>
          <span className="icon">delete</span>
        </button>
      )}
    </li>
  )
}

function NuevaRegla({ reglas, onCambio, avisar }: { reglas: Regla[]; onCambio: () => void; avisar: (m: string, e?: boolean) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [partida, setPartida] = useState<CampoPartida>('fecha_orden')
  const [unidad, setUnidad] = useState<Unidad>('habiles')
  const [cantidad, setCantidad] = useState('10')
  const [tope, setTope] = useState('')
  const [estados, setEstados] = useState<string[]>(['EN CURSO', 'PTE ENTREGA'])
  const [guardando, setGuardando] = useState(false)

  if (!abierto)
    return (
      <button className="btn tonal" onClick={() => setAbierto(true)}>
        <span className="icon">add</span>
        Añadir regla
      </button>
    )

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const n = nombre.trim()
    const c = Number(cantidad)
    if (!n || n.length > 80) return avisar('Ponle un nombre a la regla (máx. 80 letras)', true)
    if (!Number.isInteger(c) || c < 1 || c > 3650) return avisar('La cantidad debe ser un número entero entre 1 y 3650', true)
    if (!estados.length) return avisar('Elige al menos un estado', true)
    setGuardando(true)
    const err = await (
      await api()
    ).guardarRegla({
      id: idAleatorio(),
      base: false,
      activa: true,
      nombre: n,
      corto: n.slice(0, 24),
      partida,
      unidad,
      cantidad: c,
      tope: tope || null,
      estados,
    })
    setGuardando(false)
    if (err) return avisar('No se pudo guardar: ' + err, true)
    avisar('Regla añadida')
    setAbierto(false)
    setNombre('')
    onCambio()
  }

  return (
    <form className="aj-form" onSubmit={guardar}>
      <h3 className="title-s">Nueva regla de plazo</h3>
      <div className="field">
        <label htmlFor="nr-nombre">Nombre</label>
        <input
          id="nr-nombre"
          value={nombre}
          maxLength={80}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej.: Plazo de alegaciones"
          required
          autoFocus
        />
      </div>
      <div className="fields three">
        <div className="field">
          <label htmlFor="nr-cant">Cantidad</label>
          <input
            id="nr-cant"
            type="number"
            inputMode="numeric"
            min={1}
            max={3650}
            step={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="nr-uni">Unidad</label>
          <select id="nr-uni" value={unidad} onChange={(e) => setUnidad(e.target.value as Unidad)}>
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {NOMBRE_UNIDAD[u][1]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="nr-par">Desde</label>
          <select id="nr-par" value={partida} onChange={(e) => setPartida(e.target.value as CampoPartida)}>
            {CAMPOS_PARTIDA.map((c) => (
              <option key={c} value={c}>
                {NOMBRE_CAMPO[c]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="nr-tope">Sin pasar de (opcional)</label>
        <select id="nr-tope" value={tope} onChange={(e) => setTope(e.target.value)}>
          <option value="">Sin tope</option>
          {reglas.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="aj-estados">
        <legend className="label-l">Cuenta en los estados</legend>
        {ESTADOS.map((e) => (
          <label key={e} className="aj-check">
            <input
              type="checkbox"
              checked={estados.includes(e)}
              onChange={() => setEstados(estados.includes(e) ? estados.filter((x) => x !== e) : [...estados, e])}
            />
            {LABELS[e]}
          </label>
        ))}
      </fieldset>
      <div className="aj-botones">
        <button type="button" className="btn text" onClick={() => setAbierto(false)}>
          Cancelar
        </button>
        <button className="btn filled" disabled={guardando}>
          <span className="icon">save</span>
          Guardar regla
        </button>
      </div>
    </form>
  )
}
