-- Calendario · fase 2: tipos de cita, visitas/citas (eventos) y tareas.
-- Se puede ejecutar varias veces sin romper nada. NO borra tablas ni datos y NO toca `ordenes`.
-- Seguridad: igual que `ordenes` (solo usuarios con sesión; nada para `anon`; sin security definer).
-- Los CHECK validan longitudes y valores también en la base de datos (no solo en la app).

-- ---------- Tipos de cita (ampliables desde Ajustes) ----------
create table if not exists public.tipos_cita (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  nombre text not null check (char_length(nombre) between 1 and 40),
  icono text not null default 'event' check (icono ~ '^[a-z_]{1,40}$'),
  orden smallint not null default 0 check (orden between 0 and 999),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);

alter table public.tipos_cita enable row level security;

drop policy if exists "Lectura usuarios autenticados" on public.tipos_cita;
create policy "Lectura usuarios autenticados" on public.tipos_cita
  for select to authenticated using (true);
drop policy if exists "Alta usuarios autenticados" on public.tipos_cita;
create policy "Alta usuarios autenticados" on public.tipos_cita
  for insert to authenticated with check (true);
drop policy if exists "Edición usuarios autenticados" on public.tipos_cita;
create policy "Edición usuarios autenticados" on public.tipos_cita
  for update to authenticated using (true) with check (true);
drop policy if exists "Borrado usuarios autenticados" on public.tipos_cita;
create policy "Borrado usuarios autenticados" on public.tipos_cita
  for delete to authenticated using (true);

revoke all on public.tipos_cita from anon;

-- Los dos tipos del Excel. Si ya existen (o se han editado en Ajustes), no se tocan.
insert into public.tipos_cita (id, nombre, icono, orden) values
  ('visita', 'Visita', 'directions_car', 0),
  ('comparecencia', 'Comparecencia', 'gavel', 1)
on conflict (id) do nothing;

-- ---------- Visitas y citas ----------
-- Fechas como día ('date') y horas locales ('time'): sin zonas horarias que den sustos.
-- `fecha_fin` es INCLUSIVA (último día). La repetición es una RRULE SIN DTSTART: empieza en `fecha`.
create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 200),
  tipo text not null references public.tipos_cita(id) on update cascade,
  fecha date not null,
  fecha_fin date,
  todo_el_dia boolean not null default true,
  hora_inicio time,
  hora_fin time,
  ubicacion text check (ubicacion is null or char_length(ubicacion) <= 300),
  telefono text check (telefono is null or telefono ~ '^\+?[0-9 ]{3,20}$'),
  notas text check (notas is null or char_length(notas) <= 4000),
  orden_id uuid references public.ordenes(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'fallida', 'cancelada')),
  avisos integer[] not null default '{}' check (cardinality(avisos) <= 10 and 0 <= all (avisos) and 525600 >= all (avisos)),
  rrule text check (
    rrule is null or (char_length(rrule) <= 200 and rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$' and rrule !~ 'DTSTART')
  ),
  exdates date[] not null default '{}' check (cardinality(exdates) <= 500),
  serie_id uuid references public.eventos(id) on delete cascade,
  ocurrencia_original date,
  origen text not null default 'app' check (origen in ('app', 'excel')),
  clave_origen text unique check (clave_origen is null or char_length(clave_origen) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  -- Todo el día ⇔ sin hora; la hora de fin, después de la de inicio
  constraint eventos_horas check (
    (todo_el_dia and hora_inicio is null and hora_fin is null)
    or (not todo_el_dia and hora_inicio is not null and (hora_fin is null or hora_fin > hora_inicio))
  ),
  -- Varios días solo si es de todo el día
  constraint eventos_fin check (fecha_fin is null or (todo_el_dia and fecha_fin >= fecha and fecha_fin <= fecha + 366)),
  -- Excepción «solo este»: lleva serie y día original, y no se repite
  constraint eventos_excepcion check ((serie_id is null) = (ocurrencia_original is null) and (serie_id is null or rrule is null)),
  -- Las convertidas del Excel llevan su clave única (orden + fecha)
  constraint eventos_origen check (origen = 'app' or clave_origen is not null)
);

create index if not exists eventos_fecha_idx on public.eventos (fecha);
create index if not exists eventos_orden_idx on public.eventos (orden_id);
create index if not exists eventos_serie_idx on public.eventos (serie_id);
create unique index if not exists eventos_excepcion_unica on public.eventos (serie_id, ocurrencia_original) where serie_id is not null;

drop trigger if exists eventos_updated_at on public.eventos;
create trigger eventos_updated_at before update on public.eventos
for each row execute function public.set_updated_at();

alter table public.eventos enable row level security;

drop policy if exists "Lectura usuarios autenticados" on public.eventos;
create policy "Lectura usuarios autenticados" on public.eventos
  for select to authenticated using (true);
drop policy if exists "Alta usuarios autenticados" on public.eventos;
create policy "Alta usuarios autenticados" on public.eventos
  for insert to authenticated with check (true);
drop policy if exists "Edición usuarios autenticados" on public.eventos;
create policy "Edición usuarios autenticados" on public.eventos
  for update to authenticated using (true) with check (true);
drop policy if exists "Borrado usuarios autenticados" on public.eventos;
create policy "Borrado usuarios autenticados" on public.eventos
  for delete to authenticated using (true);

revoke all on public.eventos from anon;

-- ---------- Tareas ----------
create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 200),
  notas text check (notas is null or char_length(notas) <= 4000),
  orden_id uuid references public.ordenes(id) on delete cascade,
  vence date,
  hora time,
  duracion_min integer check (duracion_min is null or duracion_min between 5 and 1440),
  prioridad text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  hecha boolean not null default false,
  hecha_el date,
  repeticion text not null default 'no' check (repeticion in ('no', 'diaria', 'semanal', 'quincenal', 'mensual')),
  oficina boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  -- La hora necesita día; la duración necesita hora; repetir necesita día
  constraint tareas_coherencia check (
    (hora is null or vence is not null) and (duracion_min is null or hora is not null) and (repeticion = 'no' or vence is not null)
  )
);

create index if not exists tareas_vence_idx on public.tareas (vence);
create index if not exists tareas_orden_idx on public.tareas (orden_id);

drop trigger if exists tareas_updated_at on public.tareas;
create trigger tareas_updated_at before update on public.tareas
for each row execute function public.set_updated_at();

alter table public.tareas enable row level security;

drop policy if exists "Lectura usuarios autenticados" on public.tareas;
create policy "Lectura usuarios autenticados" on public.tareas
  for select to authenticated using (true);
drop policy if exists "Alta usuarios autenticados" on public.tareas;
create policy "Alta usuarios autenticados" on public.tareas
  for insert to authenticated with check (true);
drop policy if exists "Edición usuarios autenticados" on public.tareas;
create policy "Edición usuarios autenticados" on public.tareas
  for update to authenticated using (true) with check (true);
drop policy if exists "Borrado usuarios autenticados" on public.tareas;
create policy "Borrado usuarios autenticados" on public.tareas
  for delete to authenticated using (true);

revoke all on public.tareas from anon;
