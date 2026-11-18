-- Tabla de órdenes de inspección (migrada de la hoja ORDENES del Excel)
create type estado_orden as enum ('SIN EMPEZAR', 'EN CURSO', 'FINALIZADA');
create type estado_docum as enum ('SOLICITADA', 'PTE RECTIFICACION', 'ENTREGADA');
create type estado_visita as enum ('SIN VISITA', 'PLANIFICADA', 'REALIZADA');

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  num_orden text not null,
  estado estado_orden not null default 'SIN EMPEZAR',
  empresa text not null,
  fecha_orden date,
  fecha_primera_actuacion date,
  fecha_ultima_actuacion date,
  docum_aportada text,
  estado_docum estado_docum,
  estado_visita estado_visita,
  fecha_proxima_visita date,
  visitas_realizadas text,
  situacion_general text,
  tareas_pendientes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);

create index ordenes_estado_idx on public.ordenes (estado);
create index ordenes_created_by_idx on public.ordenes (created_by);

-- Columnas calculadas del Excel (dependen de la fecha de hoy, por eso van en una vista)
create view public.ordenes_calc with (security_invoker = true) as
select o.*,
  (o.fecha_primera_actuacion + interval '9 months')::date as fecha_limite_9m,
  case when o.fecha_ultima_actuacion is null then null
       else least((o.fecha_ultima_actuacion + interval '5 months')::date,
                  coalesce((o.fecha_primera_actuacion + interval '9 months')::date,
                           (o.fecha_ultima_actuacion + interval '5 months')::date))
  end as fecha_limite_siguiente
from public.ordenes o;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create trigger ordenes_updated_at before update on public.ordenes
for each row execute function public.set_updated_at();

-- Seguridad: solo usuarios con sesión iniciada
alter table public.ordenes enable row level security;

create policy "Lectura usuarios autenticados" on public.ordenes
  for select to authenticated using (true);
create policy "Alta usuarios autenticados" on public.ordenes
  for insert to authenticated with check (true);
create policy "Edición usuarios autenticados" on public.ordenes
  for update to authenticated using (true) with check (true);
create policy "Borrado usuarios autenticados" on public.ordenes
  for delete to authenticated using (true);

revoke all on public.ordenes, public.ordenes_calc from anon;
