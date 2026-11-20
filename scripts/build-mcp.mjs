// Empaqueta el servidor MCP (src/mcp/funcion.ts + la lógica de src/lib y src/data) en UN fichero
// para la función de Supabase: supabase/functions/mcp/index.js
// Así la función usa EXACTAMENTE el mismo código (y probado) que la web, sin copiarlo.
import { build } from 'esbuild'
import { readFileSync, statSync, writeFileSync } from 'node:fs'

const salida = 'supabase/functions/mcp/index.js'
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))

await build({
  entryPoints: ['src/mcp/funcion.ts'],
  outfile: salida,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  // Supabase Edge Runtime (Deno) entiende las APIs web estándar (fetch, Request, Response, crypto)
  conditions: ['worker', 'browser', 'import', 'default'],
  target: 'es2022',
  minify: false,
  legalComments: 'none',
  sourcemap: false,
  // Ningún secreto se mete en el paquete: solo se lee el entorno de Supabase al arrancar
  define: { 'import.meta.env': '{}' },
  banner: {
    js: `// GENERADO por scripts/build-mcp.mjs a partir de src/mcp (vicky-inspe ${pkg.version}). No editar a mano.\n`,
  },
  logLevel: 'warning',
})

const kb = Math.round(statSync(salida).size / 1024)
writeFileSync('supabase/functions/mcp/LEEME.md', `# Función «mcp»\n\n\`index.js\` se GENERA con \`npm run build:mcp\` a partir de \`src/mcp\`. No se edita a mano.\nVer \`docs/mcp-chatgpt.md\`.\n`)
console.log(`MCP empaquetado en ${salida} (${kb} KB)`)
