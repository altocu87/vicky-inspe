-- Calendario · fase 1: festivos y reglas de plazo.
-- Se puede ejecutar varias veces sin romper nada. NO borra tablas ni datos.
-- Seguridad: igual que `ordenes` (solo usuarios con sesión; nada para `anon`).

-- ---------- Festivos (para días hábiles y para marcar plazos en día inhábil) ----------
create table if not exists public.festivos (
  fecha date primary key,
  nombre text not null check (char_length(nombre) between 1 and 120),
  ambito text not null check (ambito in ('nacional', 'autonomico', 'local')),
  fuente text check (fuente is null or char_length(fuente) <= 300),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);

alter table public.festivos enable row level security;

drop policy if exists "Lectura usuarios autenticados" on public.festivos;
create policy "Lectura usuarios autenticados" on public.festivos
  for select to authenticated using (true);
drop policy if exists "Alta usuarios autenticados" on public.festivos;
create policy "Alta usuarios autenticados" on public.festivos
  for insert to authenticated with check (true);
drop policy if exists "Edición usuarios autenticados" on public.festivos;
create policy "Edición usuarios autenticados" on public.festivos
  for update to authenticated using (true) with check (true);
drop policy if exists "Borrado usuarios autenticados" on public.festivos;
create policy "Borrado usuarios autenticados" on public.festivos
  for delete to authenticated using (true);

revoke all on public.festivos from anon;

-- Festivos verificados de Albacete capital (ver src/lib/festivosAlbacete.ts).
-- Si ya existen (o se han editado en Ajustes), no se tocan.
insert into public.festivos (fecha, nombre, ambito, fuente) values
  ('2026-01-01', 'Año Nuevo', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-01-06', 'Epifanía del Señor', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-04-02', 'Jueves Santo', 'autonomico', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-04-03', 'Viernes Santo', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-04-06', 'Lunes de Pascua', 'autonomico', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-05-01', 'Fiesta del Trabajo', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-06-04', 'Corpus Christi', 'autonomico', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-06-24', 'Fiesta local de Albacete', 'local', 'Fiestas locales Albacete 2026'),
  ('2026-08-15', 'Asunción de la Virgen', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-09-08', 'Virgen de los Llanos (fiesta local)', 'local', 'Fiestas locales Albacete 2026'),
  ('2026-10-12', 'Fiesta Nacional de España', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-11-02', 'Lunes siguiente a Todos los Santos', 'autonomico', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-12-08', 'Inmaculada Concepción', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2026-12-25', 'Natividad del Señor', 'nacional', 'Decreto 44/2025 (DOCM 26-06-2025)'),
  ('2027-01-01', 'Año Nuevo', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-01-06', 'Epifanía del Señor', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-03-25', 'Jueves Santo', 'autonomico', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-03-26', 'Viernes Santo', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-05-01', 'Fiesta del Trabajo', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-05-27', 'Corpus Christi', 'autonomico', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-05-31', 'Día de Castilla-La Mancha', 'autonomico', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-10-12', 'Fiesta Nacional de España', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-11-01', 'Todos los Santos', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-12-06', 'Día de la Constitución Española', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-12-08', 'Inmaculada Concepción', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)'),
  ('2027-12-25', 'Natividad del Señor', 'nacional', 'Decreto 34/2026 (DOCM 13-07-2026)')
on conflict (fecha) do nothing;

-- ---------- Reglas de plazo ----------
-- Las reglas base (lim9, sig) viven en el código: aquí solo se guardan sus ajustes
-- (activa, días de aviso). Las reglas creadas en Ajustes se guardan completas.
-- Solo son DATOS: la app los valida al leerlos y nunca ejecuta nada de lo guardado.
create table if not exists public.reglas_plazo (
  id text primary key check (id ~ '^[a-z0-9_]{2,40}$'),
  base boolean not null default false,
  activa boolean not null default true,
  nombre text check (nombre is null or char_length(nombre) between 1 and 80),
  corto text check (corto is null or char_length(corto) between 1 and 24),
  partida text check (partida is null or partida in ('fecha_orden', 'fecha_primera_actuacion', 'fecha_ultima_actuacion')),
  unidad text check (unidad is null or unidad in ('dias', 'habiles', 'meses')),
  cantidad integer check (cantidad is null or cantidad between 1 and 3650),
  tope text check (tope is null or tope ~ '^[a-z0-9_]{2,40}$'),
  estados text[] check (estados is null or estados <@ array['EN CURSO', 'PTE ENTREGA', 'FINALIZADA']),
  avisos integer[] check (avisos is null or (cardinality(avisos) <= 12 and 0 <= all (avisos) and 365 >= all (avisos))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  constraint reglas_plazo_base check (not base or id in ('lim9', 'sig')),
  constraint reglas_plazo_completa check (
    base or (nombre is not null and partida is not null and unidad is not null and cantidad is not null)
  )
);

drop trigger if exists reglas_plazo_updated_at on public.reglas_plazo;
create trigger reglas_plazo_updated_at before update on public.reglas_plazo
for each row execute function public.set_updated_at();

alter table public.reglas_plazo enable row level security;

drop policy if exists "Lectura usuarios autenticados" on public.reglas_plazo;
create policy "Lectura usuarios autenticados" on public.reglas_plazo
  for select to authenticated using (true);
drop policy if exists "Alta usuarios autenticados" on public.reglas_plazo;
create policy "Alta usuarios autenticados" on public.reglas_plazo
  for insert to authenticated with check (true);
drop policy if exists "Edición usuarios autenticados" on public.reglas_plazo;
create policy "Edición usuarios autenticados" on public.reglas_plazo
  for update to authenticated using (true) with check (true);
drop policy if exists "Borrado usuarios autenticados" on public.reglas_plazo;
create policy "Borrado usuarios autenticados" on public.reglas_plazo
  for delete to authenticated using (true);

revoke all on public.reglas_plazo from anon;
