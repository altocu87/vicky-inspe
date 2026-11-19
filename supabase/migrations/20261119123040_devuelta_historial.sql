-- Estado «DEVUELTA» e historial de cada orden.
-- Se puede ejecutar varias veces sin romper nada. NO borra tablas ni datos (ni cambia ninguna orden).

-- ---------- Estado DEVUELTA (activa: sigue con sus plazos, como «En curso») ----------
alter table public.ordenes drop constraint if exists ordenes_estado_check;
alter table public.ordenes add constraint ordenes_estado_check
  check (estado in ('EN CURSO', 'PTE ENTREGA', 'DEVUELTA', 'FINALIZADA'));

alter table public.reglas_plazo drop constraint if exists reglas_plazo_estados_check;
alter table public.reglas_plazo add constraint reglas_plazo_estados_check
  check (estados is null or estados <@ array['EN CURSO', 'PTE ENTREGA', 'DEVUELTA', 'FINALIZADA']);

-- ---------- Historial de cambios de cada orden ----------
-- Lo escribe SOLO la base de datos (un disparador), nunca la app: así no se puede falsear ni borrar
-- desde fuera. Los usuarios con sesión solo pueden leerlo.
create table if not exists public.historial_ordenes (
  id bigint generated always as identity primary key,
  orden_id uuid not null references public.ordenes(id) on delete cascade,
  momento timestamptz not null default now(),
  tipo text not null check (tipo in ('alta', 'cambio')),
  campo text check (campo is null or campo ~ '^[a-z_]{1,40}$'),
  antes text check (antes is null or char_length(antes) <= 500),
  despues text check (despues is null or char_length(despues) <= 500),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);

create index if not exists historial_ordenes_orden_idx on public.historial_ordenes (orden_id, momento);

alter table public.historial_ordenes enable row level security;

drop policy if exists "Lectura usuarios autenticados" on public.historial_ordenes;
create policy "Lectura usuarios autenticados" on public.historial_ordenes
  for select to authenticated using (true);
-- Sin políticas de alta, edición ni borrado: nadie puede tocarlo desde la app
revoke all on public.historial_ordenes from anon;
revoke insert, update, delete, truncate on public.historial_ordenes from authenticated;

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
begin
  if tg_op = 'INSERT' then
    insert into public.historial_ordenes (orden_id, tipo, despues, created_by) values (new.id, 'alta', new.estado, auth.uid());
    return new;
  end if;
  viejo := to_jsonb(old);
  nuevo := to_jsonb(new);
  foreach c in array campos loop
    a := viejo ->> c;
    d := nuevo ->> c;
    if a is distinct from d then
      insert into public.historial_ordenes (orden_id, tipo, campo, antes, despues, created_by)
      values (new.id, 'cambio', c, left(a, 500), left(d, 500), auth.uid());
    end if;
  end loop;
  return new;
end; $$;

revoke all on function public.registrar_historial_orden() from public, anon, authenticated;

drop trigger if exists ordenes_historial on public.ordenes;
create trigger ordenes_historial after insert or update on public.ordenes
for each row execute function public.registrar_historial_orden();
