-- =====================================================================================
-- PROPUESTAS DE CAMBIOS EN LA BASE DE DATOS — auditoría, puntos 4 a 15 (prioridad media)
-- =====================================================================================
-- ESTE FICHERO NO SE EJECUTA SOLO. No está en supabase/migrations a propósito.
-- Cada bloque es independiente: se puede copiar y pegar en el «SQL Editor» de Supabase
-- de uno en uno, leyendo antes su comentario. La web funciona igual antes y después.
-- Antes de aplicar nada: haz una copia (Database → Backups, o exporta las tablas).
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- #5 · Solo el conector de ChatGPT autorizado puede usar los datos con un token OAuth
-- -------------------------------------------------------------------------------------
-- Qué pasa hoy: el token que obtiene CUALQUIER asistente conectado por OAuth (lleva «client_id»)
-- sirve también contra la API REST directa (sin pasar por el servidor MCP), así que la lista
-- MCP_CLIENTES_PERMITIDOS del servidor no basta.
-- Qué hace: añade una política «restrictive» (se suma a las que hay: hay que cumplir todas).
--   · Sesión normal de la web (sin client_id)        → igual que ahora.
--   · Token del conector de ChatGPT autorizado       → igual que ahora.
--   · Token de cualquier otro asistente              → no ve ni cambia nada.
-- ANTES DE APLICAR: sustituye <CLIENT_ID_CHATGPT> por el id real del conector (el mismo que pongas
-- en VITE_OAUTH_CLIENTES de Vercel). Se ve en la pantalla «No se ha conectado» al intentar conectar,
-- o en Authentication → OAuth Apps del panel. Si algún día se cambia de conector, hay que
-- actualizar el id aquí (drop policy + create policy) o ChatGPT dejará de ver los datos.
do $$
declare
  t text;
begin
  foreach t in array array['ordenes', 'eventos', 'tareas', 'festivos', 'reglas_plazo', 'tipos_cita'] loop
    execute format('drop policy if exists "Solo el asistente autorizado" on public.%I', t);
    execute format(
      'create policy "Solo el asistente autorizado" on public.%I as restrictive for all to authenticated '
      || 'using (coalesce((select auth.jwt()) ->> ''client_id'', '''') in ('''', ''<CLIENT_ID_CHATGPT>'')) '
      || 'with check (coalesce((select auth.jwt()) ->> ''client_id'', '''') in ('''', ''<CLIENT_ID_CHATGPT>''))',
      t);
  end loop;
end $$;

-- El historial solo se lee (lo escribe un disparador con permisos propios), por eso «for select».
drop policy if exists "Solo el asistente autorizado" on public.historial_ordenes;
create policy "Solo el asistente autorizado" on public.historial_ordenes as restrictive
  for select to authenticated
  using (coalesce((select auth.jwt()) ->> 'client_id', '') in ('', '<CLIENT_ID_CHATGPT>'));
