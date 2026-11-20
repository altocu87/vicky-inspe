// Punto de entrada de la función de Supabase «mcp» (Deno). Se empaqueta con `npm run build:mcp`
// en supabase/functions/mcp/index.js (ese fichero se genera; no se edita a mano).
//
// Dirección: https://nzhebiuybvmkopzayxsa.supabase.co/functions/v1/mcp
// Variables: las pone Supabase solo (SUPABASE_URL y las claves públicas). NO hace falta ningún secreto.
// Opcional: MCP_CLIENTES_PERMITIDOS = ids de cliente OAuth separados por comas (para fijar ChatGPT).
import { pipeline } from '@supabase/middleware'
import { fromSupabaseUrl, withOAuthProtectedResource, withSupabase } from '@supabase/server'
import { crearBackendSupabase } from '../data/supabaseDatos'
import { comprobarIdentidad, crearAtender } from './http'

declare const Deno: { env: { get(n: string): string | undefined }; serve(h: (req: Request) => Response | Promise<Response>): unknown }

const url = Deno.env.get('SUPABASE_URL')
if (!url) throw new Error('Falta SUPABASE_URL')
const clientesPermitidos = (Deno.env.get('MCP_CLIENTES_PERMITIDOS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const atender = crearAtender()

Deno.serve(
  pipeline(
    [
      // 1. Dice a ChatGPT dónde está el inicio de sesión (Supabase Auth de la app)
      withOAuthProtectedResource(),
      // 2. Comprueba el token (firma con las claves públicas del proyecto, caducidad y emisor = este proyecto)
      withSupabase({ auth: 'user', issuer: fromSupabaseUrl(url) }),
    ],
    async (req, { supabase, jwtClaims }) => {
      // 3. Solo conexiones OAuth vivas; los datos, SIEMPRE con la sesión de la usuaria (RLS)
      const id = await comprobarIdentidad(req, supabase, jwtClaims as Record<string, unknown> | null, () => crearBackendSupabase(supabase), { clientesPermitidos })
      if (id instanceof Response) return id
      return atender(req, id)
    },
  ),
)
