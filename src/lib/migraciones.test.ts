// Comprobaciones de seguridad e integridad sobre los ficheros de migración.
import { describe, expect, it } from 'vitest'
import { FESTIVOS_ALBACETE } from './festivosAlbacete'
import { TIPOS_BASE } from './eventos'

const ficheros = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
// Las 3 primeras son anteriores a estas reglas (la 2.ª recreó la tabla cuando estaba vacía)
const HISTORICAS = ['20261118190000', '20261118210000', '20261118230000']
const nuevas = Object.entries(ficheros).filter(([f]) => !HISTORICAS.some((h) => f.includes(h)))
const sinComentarios = (s: string) => s.replace(/--.*$/gm, '')

describe('migraciones', () => {
  it('hay migraciones nuevas y su nombre lleva fecha y hora de 14 cifras', () => {
    expect(nuevas.length).toBeGreaterThan(0)
    for (const [f] of Object.entries(ficheros)) expect(f).toMatch(/\/\d{14}_[a-z0-9_]+\.sql$/)
  })
  it.each(nuevas)('%s no borra tablas ni datos', (_f, sql) => {
    const s = sinComentarios(sql).toLowerCase()
    expect(s).not.toMatch(/drop\s+table|truncate|delete\s+from|drop\s+column|drop\s+schema/)
    expect(s).not.toMatch(/update\s+public\.ordenes/)
  })
  it.each(nuevas)('%s: toda tabla nueva tiene RLS, es idempotente y nada para anon', (_f, sql) => {
    const s = sinComentarios(sql).toLowerCase()
    const tablas = [...s.matchAll(/create table (if not exists )?public\.(\w+)/g)]
    for (const t of tablas) {
      expect(t[1], `${t[2]} debe usar IF NOT EXISTS`).toBeTruthy()
      expect(s).toContain(`alter table public.${t[2]} enable row level security`)
      expect(s).toMatch(new RegExp(`revoke all on [^;]*public\\.${t[2]}[^;]* from anon`))
    }
    // Cada política va precedida de su DROP POLICY IF EXISTS
    for (const m of s.matchAll(/create policy "([^"]+)" on public\.(\w+)/g)) {
      expect(s).toContain(`drop policy if exists "${m[1]}" on public.${m[2]}`)
    }
    // Las políticas solo para usuarios con sesión
    for (const m of s.matchAll(/create policy [^;]*;/g)) expect(m[0]).toContain('to authenticated')
    expect(s).not.toMatch(/\bto (anon|public)\b/)
    // Ninguna función salta la seguridad de filas
    expect(s).not.toMatch(/security definer/)
  })
  it('los festivos de la migración son exactamente los de festivosAlbacete.ts', () => {
    const sql = Object.entries(ficheros).find(([f]) => f.includes('calendario_fase1'))![1]
    const enSql = [...sql.matchAll(/\('(\d{4}-\d{2}-\d{2})', '((?:[^']|'')+)', '(\w+)', '([^']*)'\)/g)].map((m) => ({
      fecha: m[1],
      nombre: m[2].replace(/''/g, "'"),
      ambito: m[3],
      fuente: m[4],
    }))
    expect(enSql).toEqual(FESTIVOS_ALBACETE.map((f) => ({ ...f })))
  })
})

describe('migración de la fase 2', () => {
  const sql = sinComentarios(Object.entries(ficheros).find(([f]) => f.includes('calendario_fase2'))![1]).toLowerCase()
  it('crea tipos_cita, eventos y tareas con las 4 políticas cada una', () => {
    for (const t of ['tipos_cita', 'eventos', 'tareas']) {
      expect(sql).toContain(`create table if not exists public.${t}`)
      expect([...sql.matchAll(new RegExp(`create policy "[^"]+" on public\\.${t}\\b`, 'g'))]).toHaveLength(4)
      expect(sql).toMatch(new RegExp(`${t}[^;]*created_by uuid default auth\\.uid\\(\\)|created_by uuid default auth\\.uid\\(\\)`))
    }
  })
  it('no toca la tabla ordenes (solo la referencia)', () => {
    expect(sql).not.toMatch(/alter table public\.ordenes|update public\.ordenes|insert into public\.ordenes/)
  })
  it('los tipos de cita del SQL son los de eventos.ts', () => {
    const enSql = [...sql.matchAll(/\('([a-z_]+)', '([^']+)', '([a-z_]+)', (\d+)\)/g)].map((m) => m[1])
    expect(enSql).toEqual(TIPOS_BASE.map((t) => t.id))
  })
  it('valida en la base de datos: textos con longitud, estados cerrados y RRULE sin DTSTART', () => {
    expect(sql).toContain("estado in ('pendiente', 'hecha', 'fallida', 'cancelada')")
    expect(sql).toContain("rrule !~ 'dtstart'")
    expect(sql).toMatch(/char_length\(titulo\) between 1 and 200/)
  })
})

describe('conversión de fecha_visita (SQL a mano, solo con permiso)', () => {
  const conv = import.meta.glob('../../supabase/conversiones/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const [[nombre, sql]] = Object.entries(conv)
  const s = sinComentarios(sql).toLowerCase()
  it('NO está entre las migraciones automáticas', () => expect(nombre).not.toContain('/migrations/'))
  it('no toca ordenes ni borra nada, y no duplica', () => {
    expect(s).not.toMatch(/update\s+public\.ordenes|delete\s+from|drop\s+table|truncate|security definer/)
    expect(s).toContain('on conflict (clave_origen) do nothing')
    expect(s).toContain('pg_temp.convertir_fecha_visita')
  })
})

describe('cabeceras de seguridad', () => {
  const raw = import.meta.glob(['../../vercel.json', '../../seguridad.headers.json'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const vercel = JSON.parse(raw['../../vercel.json']) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
  const local = JSON.parse(raw['../../seguridad.headers.json']) as Record<string, string>
  const h = Object.fromEntries(vercel.headers[0].headers.map((x) => [x.key, x.value]))
  it('se aplican a todas las rutas', () => expect(vercel.headers[0].source).toBe('/(.*)'))
  it('la prueba local usa las mismas que Vercel', () => {
    for (const [k, v] of Object.entries(local)) expect(h[k]).toBe(v)
  })
  it('CSP estricta: sin scripts externos ni eval, sin marcos', () => {
    const csp = h['Content-Security-Policy']
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toMatch(/unsafe-eval|script-src[^;]*unsafe-inline/)
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(h['X-Frame-Options']).toBe('DENY')
  })
})
