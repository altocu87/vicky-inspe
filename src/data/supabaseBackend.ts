// Acceso real a Supabase desde la web, con la sesión del navegador. Solo lo usa api.ts.
import { supabase } from '../lib/supabase'
import { crearBackendSupabase } from './supabaseDatos'

export const backendSupabase = crearBackendSupabase(supabase)
