-- =====================================================================================
-- Propuestas de cambios en la base de datos — auditoría, puntos 16 a 30 (prioridad baja)
-- =====================================================================================
-- NADA de esto se ha aplicado. Es una propuesta para revisarla y aplicarla a mano
-- (SQL Editor de Supabase o una migración nueva) cuando se decida.
-- No va en supabase/migrations a propósito.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- Punto 28 · Caducidad del token (JWT) a 15 minutos
-- -------------------------------------------------------------------------------------
-- No es SQL: es un ajuste del panel de Supabase.
-- En supabase/config.toml ya está jwt_expiry = 900 (15 minutos), pero ese archivo solo se
-- usa en local. En el proyecto real hay que poner el MISMO valor a mano:
--   Panel de Supabase → Authentication → Sessions (o «JWT Settings») → «JWT expiry» = 900
-- Efecto: al quitar el acceso a ChatGPT en Ajustes, su token deja de valer contra la API
-- como mucho en 15 minutos (antes, hasta 1 hora). La web renueva el token sola; no se nota.


-- -------------------------------------------------------------------------------------
-- Punto 29 · RLS por usuario autorizado
-- ⚠️ SOLO ANTES DE DAR DE ALTA A OTRA PERSONA. Hoy hay una sola usuaria y no hace falta.
-- -------------------------------------------------------------------------------------
-- Ahora mismo las políticas dicen `using (true)` para cualquier usuario con sesión
-- (`authenticated`). Como el registro público está desactivado y solo existe una cuenta,
-- es seguro. Pero si algún día se crea otra cuenta (aunque sea de prueba), esa persona
-- vería y podría cambiar TODO. Antes de eso, aplicar esto:

-- 1) Lista de cuentas que pueden usar la app
create table if not exists public.usuarios_autorizados (
  id uuid primary key references auth.users(id) on delete cascade,
  nota text,
  created_at timestamptz not null default now()
);
alter table public.usuarios_autorizados enable row level security;
-- Cada cuenta solo puede ver si ella misma está en la lista; nadie la cambia desde la app
drop policy if exists "Ver la propia fila" on public.usuarios_autorizados;
create policy "Ver la propia fila" on public.usuarios_autorizados
  for select to authenticated using (id = (select auth.uid()));
revoke all on public.usuarios_autorizados from anon;
revoke insert, update, delete, truncate on public.usuarios_autorizados from authenticated;

-- 2) Dar de alta a la usuaria actual (cambiar el correo por el suyo real antes de ejecutar)
-- insert into public.usuarios_autorizados (id, nota)
--   select id, 'Titular' from auth.users where email = 'CORREO_DE_LA_USUARIA'
--   on conflict (id) do nothing;

-- 3) Política RESTRICTIVA en cada tabla: se suma (con «y») a las que ya hay, así que
--    no hace falta tocar las existentes. Sin estar en la lista, no se ve ni se cambia nada.
--    (También afecta a ChatGPT: entra con el mismo usuario, así que sigue funcionando.)
do $$
declare t text;
begin
  foreach t in array array['ordenes', 'festivos', 'reglas_plazo', 'tipos_cita', 'eventos', 'tareas', 'historial_ordenes'] loop
    execute format('drop policy if exists "Solo usuarios autorizados" on public.%I', t);
    execute format(
      'create policy "Solo usuarios autorizados" on public.%I as restrictive for all to authenticated '
      || 'using (exists (select 1 from public.usuarios_autorizados u where u.id = (select auth.uid()))) '
      || 'with check (exists (select 1 from public.usuarios_autorizados u where u.id = (select auth.uid())))',
      t);
  end loop;
end $$;

-- Comprobación después de aplicarlo: con la sesión de la usuaria, la app debe ver sus órdenes;
-- con otra cuenta que no esté en la lista, la app debe salir vacía.


-- -------------------------------------------------------------------------------------
-- Punto 30 · Quitar permisos que sobran
-- -------------------------------------------------------------------------------------
-- Supabase da por defecto a `authenticated` permisos que la app nunca usa:
--   TRUNCATE (vaciar una tabla entera de golpe, y además se salta RLS),
--   TRIGGER (crear disparadores) y REFERENCES (crear claves ajenas hacia la tabla).
-- Se quitan en todas las tablas de la app. Lo que la app sí usa (select, insert, update,
-- delete) sigue igual y lo siguen controlando las políticas RLS.
-- Revisadas las migraciones: además de las 6 tablas de la propuesta original está
-- `historial_ordenes` (fase «devuelta + historial»), que ya tiene quitado truncate pero no
-- trigger ni references. La vista `ordenes_calc` se borró en una migración posterior.
-- El servidor MCP no crea tablas propias (solo políticas).
revoke truncate, trigger, references on
  public.ordenes,
  public.festivos,
  public.reglas_plazo,
  public.tipos_cita,
  public.eventos,
  public.tareas,
  public.historial_ordenes
from authenticated;

-- Tablas que se creen en el futuro en `public`: que `anon` (sin sesión) no reciba nada
-- por defecto. (Las migraciones ya hacen `revoke all ... from anon` tabla a tabla; esto
-- evita olvidos.) Se aplica a las tablas que cree el rol que ejecute esto (normalmente `postgres`).
alter default privileges in schema public revoke all on tables from anon;
-- Opcional, por coherencia: tampoco funciones ni secuencias nuevas para `anon`
-- alter default privileges in schema public revoke all on functions from anon;
-- alter default privileges in schema public revoke all on sequences from anon;

-- Si se aplica también el punto 29, añadir `public.usuarios_autorizados` a la lista del revoke.
