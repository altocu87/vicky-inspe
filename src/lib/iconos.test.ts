// La fuente de iconos solo trae los iconos de la lista `icon_names` de index.html.
// Si se usa un icono que no está en la lista, se vería como texto: esta prueba lo avisa.
import { describe, expect, it } from 'vitest'
import { ICONOS_TIPO } from './eventos'
import html from '../../index.html?raw'

const lista = /icon_names=([a-z0-9_,]+)/.exec(html)?.[1].split(',') ?? []

// Todo el código de la app (sin pruebas ni el servidor MCP), como texto
const fuentes = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.ts', '!../mcp/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Iconos escritos tal cual dentro de <span className="icon…">…</span> */
function iconosEnCodigo(): Set<string> {
  const out = new Set<string>()
  for (const s of Object.values(fuentes)) {
    for (const m of s.matchAll(/className=[{"'`][^>]*\bicon(?![\w-])[^>]*>([^<]*)</g)) {
      const dentro = m[1].trim()
      if (/^[a-z][a-z0-9_]*$/.test(dentro)) out.add(dentro)
      // En expresiones como {a ? 'check' : 'close'}: los textos que son el RESULTADO (tras ? : ??)
      else for (const q of dentro.matchAll(/(?:\?|:)\s*'([a-z][a-z0-9_]*)'/g)) out.add(q[1])
    }
  }
  return out
}

describe('lista de iconos de index.html', () => {
  it('lee el código de la app', () => {
    expect(Object.keys(fuentes).length).toBeGreaterThan(30)
  })

  it('existe, sin repetidos y en orden alfabético (lo exige Google Fonts)', () => {
    expect(lista.length).toBeGreaterThan(50)
    expect(new Set(lista).size).toBe(lista.length)
    expect([...lista].sort()).toEqual(lista)
  })

  it('incluye los iconos que se pueden elegir para los tipos de cita', () => {
    for (const i of ICONOS_TIPO) expect(lista, i).toContain(i)
  })

  it('incluye todos los iconos escritos en los componentes', () => {
    const faltan = [...iconosEnCodigo()].filter((i) => !lista.includes(i))
    expect(faltan).toEqual([])
  })
})
