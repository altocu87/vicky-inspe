-- Respaldo automático en una hoja de Google Sheets (SOLO COPIA: la hoja nunca escribe en la web).
-- Se puede ejecutar varias veces sin romper nada. NO borra tablas ni datos y NO cambia ninguna fila.
--
-- Cómo funciona:
--   1. Cada vez que se crea, cambia o borra algo en las tablas de la app, un disparador manda esa fila
--      a la hoja (un «buzón» hecho con Apps Script). El envío lo hace pg_net DESPUÉS de guardar y en
--      segundo plano: si Google falla o tarda, la app NO se entera ni se bloquea.
--   2. Cada noche (04:00 en España, 03:00 UTC) se manda todo entero, por si algún aviso se perdió.
--   3. La dirección del buzón y su contraseña se guardan cifradas en Supabase Vault. Hasta que alguien
--      ejecute `select respaldo.configurar('<url>', '<token>');` en el editor SQL, no se envía nada.
--
-- Seguridad: todo vive en el esquema `respaldo`, sin permisos para `anon` ni `authenticated`.
-- SECURITY DEFINER justificado en el disparador: tiene que poder leer el Vault y llamar a pg_net,
-- cosas que los usuarios de la web NO pueden hacer. search_path vacío.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists respaldo;
revoke all on schema respaldo from public, anon, authenticated;

-- Tablas que se copian (cada una irá a su pestaña). La clave es la columna que identifica cada fila.
create or replace function respaldo.tablas() returns table (tabla text, clave text)
language sql immutable set search_path = '' as $$
  values
    ('ordenes', 'id'),
    ('eventos', 'id'),
    ('tareas', 'id'),
    ('historial_ordenes', 'id'),
    ('tipos_cita', 'id'),
    ('festivos', 'fecha'),
    ('reglas_plazo', 'id');
$$;

-- Lee un secreto del Vault (null si no está).
create or replace function respaldo.secreto(p_nombre text) returns text
language sql stable security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_nombre limit 1;
$$;

-- Nombres de las columnas de una tabla, en su orden real (para que la hoja salga ordenada).
create or replace function respaldo.columnas(p_tabla regclass) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(attname order by attnum), '[]'::jsonb)
  from pg_catalog.pg_attribute
  where attrelid = p_tabla and attnum > 0 and not attisdropped;
$$;

-- Manda un paquete al buzón de la hoja. No hace nada si aún no está configurado.
create or replace function respaldo.enviar(p_cuerpo jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text := respaldo.secreto('respaldo_google_url');
  v_token text := respaldo.secreto('respaldo_google_token');
begin
  if v_url is null or v_token is null then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    body := p_cuerpo || jsonb_build_object('token', v_token, 'momento', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end; $$;

-- Disparador: una fila creada, cambiada o borrada → un aviso a la hoja.
create or replace function respaldo.avisar_cambio() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_fila jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_clave text;
begin
  select t.clave into v_clave from respaldo.tablas() t where t.tabla = tg_table_name;
  perform respaldo.enviar(jsonb_build_object(
    'tipo', 'cambio',
    'tabla', tg_table_name,
    'operacion', tg_op,
    'clave', v_fila ->> coalesce(v_clave, 'id'),
    'columnas', respaldo.columnas(tg_relid),
    'fila', v_fila
  ));
  return null;
exception when others then
  -- El respaldo NUNCA puede impedir que se guarde algo en la app.
  raise warning 'respaldo Google Sheets: no se pudo preparar el aviso (%)', sqlerrm;
  return null;
end; $$;

-- Manda todas las tablas enteras (copia completa). La usa el trabajo de cada noche.
create or replace function respaldo.enviar_todo() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  t record;
  v_filas jsonb;
  n integer := 0;
begin
  for t in select * from respaldo.tablas() loop
    if to_regclass('public.' || t.tabla) is null then
      continue;
    end if;
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t.tabla) into v_filas;
    if respaldo.enviar(jsonb_build_object(
      'tipo', 'completo',
      'tabla', t.tabla,
      'clave', t.clave,
      'columnas', respaldo.columnas(('public.' || t.tabla)::regclass),
      'filas', v_filas
    )) is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end; $$;

-- Guarda (o cambia) la dirección del buzón y su contraseña, y manda una copia completa al momento.
-- Se ejecuta a mano en el editor SQL de Supabase: select respaldo.configurar('https://script.google.com/macros/s/…/exec', '…');
create or replace function respaldo.configurar(p_url text, p_token text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_url !~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$' then
    raise exception 'La dirección no parece la de una aplicación web de Apps Script (debe acabar en /exec)';
  end if;
  if p_token !~ '^[A-Za-z0-9]{32,128}$' then
    raise exception 'La contraseña no tiene el formato esperado (cópiala tal cual desde la hoja)';
  end if;

  select id into v_id from vault.secrets where name = 'respaldo_google_url';
  if v_id is null then
    perform vault.create_secret(p_url, 'respaldo_google_url', 'Buzón de la hoja de respaldo (Apps Script)');
  else
    perform vault.update_secret(v_id, p_url);
  end if;

  select id into v_id from vault.secrets where name = 'respaldo_google_token';
  if v_id is null then
    perform vault.create_secret(p_token, 'respaldo_google_token', 'Contraseña del buzón de la hoja de respaldo');
  else
    perform vault.update_secret(v_id, p_token);
  end if;

  return format('Respaldo configurado. Enviadas %s tablas a la hoja.', respaldo.enviar_todo());
end; $$;

-- Para pararlo todo: borra la dirección y la contraseña (los disparadores siguen, pero ya no envían nada).
create or replace function respaldo.desconectar() returns text
language sql security definer set search_path = '' as $$
  delete from vault.secrets where name in ('respaldo_google_url', 'respaldo_google_token');
  select 'Respaldo desconectado: ya no se envía nada a la hoja.';
$$;

revoke all on all functions in schema respaldo from public, anon, authenticated;

-- Un disparador por tabla (después de guardar, fila a fila).
do $$
declare
  t record;
begin
  for t in select * from respaldo.tablas() loop
    if to_regclass('public.' || t.tabla) is not null then
      execute format('drop trigger if exists respaldo_google on public.%I', t.tabla);
      execute format(
        'create trigger respaldo_google after insert or update or delete on public.%I for each row execute function respaldo.avisar_cambio()',
        t.tabla);
    end if;
  end loop;
end $$;

-- Copia completa cada noche a las 03:00 UTC (04:00 en invierno / 05:00 en verano en España).
select cron.schedule('respaldo-google-sheets', '0 3 * * *', 'select respaldo.enviar_todo()');
