-- Servidor MCP para ChatGPT.
-- Se puede ejecutar varias veces sin romper nada. NO borra tablas ni datos (ni cambia ninguna orden).
--
-- Las sesiones que vienen de un asistente conectado por OAuth (ChatGPT) llevan en su token el campo
-- «client_id»; las de la web, no. Con eso:
--   1. El historial de cada orden apunta de dónde viene cada cambio: «app» o «chatgpt».
--   2. Protección extra: con una sesión de asistente NO se puede borrar nada (órdenes, visitas, tareas)
--      ni tocar los ajustes (festivos, reglas de plazo, tipos de cita), aunque alguien llamara a la base
--      de datos directamente saltándose el servidor MCP. La web (sin client_id) sigue igual que antes.
-- Las políticas «restrictive» se suman a las que ya hay: para poder hacer algo hay que cumplir las dos.

-- ---------- 1. Origen de cada cambio en el historial ----------
alter table public.historial_ordenes add column if not exists origen text not null default 'app';
alter table public.historial_ordenes drop constraint if exists historial_ordenes_origen_check;
alter table public.historial_ordenes add constraint historial_ordenes_origen_check check (origen in ('app', 'chatgpt'));

-- Igual que en 20261119123040_devuelta_historial.sql, más el origen.
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
      values (new.id, 'cambio', c, left(a, 500), left(d, 500), auth.uid(), org);
    end if;
  end loop;
  return new;
end; $$;

revoke all on function public.registrar_historial_orden() from public, anon, authenticated;

-- ---------- 2. Los asistentes no borran ni tocan los ajustes ----------
-- Órdenes, visitas/citas y tareas: se pueden leer, crear y cambiar, pero NO borrar.
drop policy if exists "Asistentes no borran" on public.ordenes;
create policy "Asistentes no borran" on public.ordenes as restrictive
  for delete to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');

drop policy if exists "Asistentes no borran" on public.eventos;
create policy "Asistentes no borran" on public.eventos as restrictive
  for delete to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');

drop policy if exists "Asistentes no borran" on public.tareas;
create policy "Asistentes no borran" on public.tareas as restrictive
  for delete to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');

-- Ajustes (festivos, reglas de plazo, tipos de cita): solo lectura para los asistentes.
drop policy if exists "Asistentes no dan de alta ajustes" on public.festivos;
create policy "Asistentes no dan de alta ajustes" on public.festivos as restrictive
  for insert to authenticated with check (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
drop policy if exists "Asistentes no cambian ajustes" on public.festivos;
create policy "Asistentes no cambian ajustes" on public.festivos as restrictive
  for update to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
drop policy if exists "Asistentes no borran" on public.festivos;
create policy "Asistentes no borran" on public.festivos as restrictive
  for delete to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');

drop policy if exists "Asistentes no dan de alta ajustes" on public.reglas_plazo;
create policy "Asistentes no dan de alta ajustes" on public.reglas_plazo as restrictive
  for insert to authenticated with check (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
drop policy if exists "Asistentes no cambian ajustes" on public.reglas_plazo;
create policy "Asistentes no cambian ajustes" on public.reglas_plazo as restrictive
  for update to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
drop policy if exists "Asistentes no borran" on public.reglas_plazo;
create policy "Asistentes no borran" on public.reglas_plazo as restrictive
  for delete to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');

drop policy if exists "Asistentes no dan de alta ajustes" on public.tipos_cita;
create policy "Asistentes no dan de alta ajustes" on public.tipos_cita as restrictive
  for insert to authenticated with check (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
drop policy if exists "Asistentes no cambian ajustes" on public.tipos_cita;
create policy "Asistentes no cambian ajustes" on public.tipos_cita as restrictive
  for update to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
drop policy if exists "Asistentes no borran" on public.tipos_cita;
create policy "Asistentes no borran" on public.tipos_cita as restrictive
  for delete to authenticated using (coalesce((select auth.jwt()) ->> 'client_id', '') = '');
