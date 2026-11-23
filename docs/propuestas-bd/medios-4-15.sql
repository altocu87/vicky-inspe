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


-- -------------------------------------------------------------------------------------
-- #7 · El historial guarda los textos largos enteros (hasta 4000 caracteres)
-- -------------------------------------------------------------------------------------
-- Qué pasa hoy: si se vacía o se cambia «Situación general» o «Tareas pendientes» (desde la web o
-- desde ChatGPT), el historial solo guarda los primeros 500 caracteres del texto anterior: el resto
-- se pierde para siempre.
-- Qué hace:
--   1. Amplía los límites del historial (antes/después) de 500 a 4000 caracteres.
--   2. Vuelve a crear el disparador del historial IGUAL que ahora (security definer, search_path vacío,
--      origen app/chatgpt) pero guardando hasta 4000 caracteres.
--   3. Pone en las órdenes un límite de longitud igual al de la app (formulario y ChatGPT).
--      «not valid» = no revisa las órdenes que ya existen (si alguna fuese más larga, no falla);
--      solo se aplica a lo que se guarde a partir de ahora.
-- No borra ni cambia ningún dato.

-- 1. Límites del historial
alter table public.historial_ordenes drop constraint if exists historial_ordenes_antes_check;
alter table public.historial_ordenes add constraint historial_ordenes_antes_check check (antes is null or char_length(antes) <= 4000);
alter table public.historial_ordenes drop constraint if exists historial_ordenes_despues_check;
alter table public.historial_ordenes add constraint historial_ordenes_despues_check check (despues is null or char_length(despues) <= 4000);

-- 2. Disparador del historial (copia de 20261120090000_mcp_chatgpt.sql con left(…, 4000))
-- SECURITY DEFINER justificado: el disparador tiene que poder escribir en el historial aunque
-- los usuarios NO puedan (así el historial es fiable). search_path vacío y sin permiso para llamarla.
create or replace function public.registrar_historial_orden() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  campos constant text[] := array[
    'estado', 'num_orden', 'empresa', 'fecha_orden', 'fecha_primera_actuacion', 'fecha_ultima_actuacion',
    'fecha_cierre', 'objeto', 'estado_docum', 'estado_visita', 'fecha_visita', 'situacion_general',
    'tareas_pendientes', 'comparecencia_subida', 'doc_subida', 'claves'];
  c text;
  a text;
  d text;
  viejo jsonb;
  nuevo jsonb;
  org text;
begin
  -- Token con client_id = conexión OAuth de un asistente (el único autorizado es ChatGPT)
  org := case when coalesce(auth.jwt() ->> 'client_id', '') <> '' then 'chatgpt' else 'app' end;
  if tg_op = 'INSERT' then
    insert into public.historial_ordenes (orden_id, tipo, despues, created_by, origen) values (new.id, 'alta', new.estado, auth.uid(), org);
    return new;
  end if;
  viejo := to_jsonb(old);
  nuevo := to_jsonb(new);
  foreach c in array campos loop
    a := viejo ->> c;
    d := nuevo ->> c;
    if a is distinct from d then
      insert into public.historial_ordenes (orden_id, tipo, campo, antes, despues, created_by, origen)
      values (new.id, 'cambio', c, left(a, 4000), left(d, 4000), auth.uid(), org);
    end if;
  end loop;
  return new;
end; $$;

revoke all on function public.registrar_historial_orden() from public, anon, authenticated;

-- 3. Límites de longitud en las órdenes (los mismos que MAX_TEXTO en src/lib/ordenes.ts)
alter table public.ordenes drop constraint if exists ordenes_longitud_textos;
alter table public.ordenes add constraint ordenes_longitud_textos check (
  char_length(num_orden) <= 40
  and char_length(empresa) <= 200
  and (objeto is null or char_length(objeto) <= 500)
  and (fecha_visita is null or char_length(fecha_visita) <= 500)
  and (situacion_general is null or char_length(situacion_general) <= 4000)
  and (tareas_pendientes is null or char_length(tareas_pendientes) <= 4000)
) not valid;
-- (Opcional) Para ver si alguna orden antigua pasa de esos límites:
-- select id, num_orden from public.ordenes where char_length(coalesce(situacion_general, '')) > 4000
--   or char_length(coalesce(tareas_pendientes, '')) > 4000 or char_length(coalesce(objeto, '')) > 500
--   or char_length(coalesce(fecha_visita, '')) > 500 or char_length(num_orden) > 40 or char_length(empresa) > 200;
