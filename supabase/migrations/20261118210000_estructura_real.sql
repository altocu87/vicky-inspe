-- Ajuste a la estructura del Excel real (hoja "Hoja 1").
-- La tabla anterior estaba vacía, así que se recrea.
drop view if exists public.ordenes_calc;
drop table if exists public.ordenes;
drop type if exists estado_orden;
drop type if exists estado_docum;
drop type if exists estado_visita;

create table public.ordenes (
  id uuid primary key default gen_random_uuid(),
  num_orden text not null,
  estado text not null default 'EN CURSO'
    check (estado in ('EN CURSO', 'PTE ENTREGA', 'FINALIZADA')),
  empresa text not null,
  fecha_orden date,
  fecha_primera_actuacion date,
  fecha_ultima_actuacion date,
  objeto text,
  estado_docum text check (estado_docum in ('RECIBIDA', 'AUN NADA', 'SOLICITADA', 'NO SE PIDE')),
  estado_visita text,           -- SIN VISITA, REALIZADA, 1ª FALLIDA... (admite combinaciones)
  fecha_visita text,            -- fechas o notas libres, como en el Excel
  situacion_general text,
  tareas_pendientes text,
  comparecencia_subida text check (comparecencia_subida in ('SI', 'NO SE PONE')),
  doc_subida text check (doc_subida in ('SI', 'NO SE PONE')),
  claves text check (claves in ('SI', 'NO SE PONE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);

create index ordenes_estado_idx on public.ordenes (estado);
create index ordenes_fecha_orden_idx on public.ordenes (fecha_orden desc);
create index ordenes_created_by_idx on public.ordenes (created_by);

create trigger ordenes_updated_at before update on public.ordenes
for each row execute function public.set_updated_at();

alter table public.ordenes enable row level security;

create policy "Lectura usuarios autenticados" on public.ordenes
  for select to authenticated using (true);
create policy "Alta usuarios autenticados" on public.ordenes
  for insert to authenticated with check (true);
create policy "Edición usuarios autenticados" on public.ordenes
  for update to authenticated using (true) with check (true);
create policy "Borrado usuarios autenticados" on public.ordenes
  for delete to authenticated using (true);

revoke all on public.ordenes from anon;
