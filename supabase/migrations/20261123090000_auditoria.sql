-- =====================================================================================
-- Auditoría (23-11-2026): cambios de base de datos aprobados por la usuaria.
-- Se puede ejecutar más de una vez sin problema. Todo o nada (una sola transacción).
-- NO incluye: #5 (se resuelve desactivando el OAuth Server en el panel) ni #29 (solo antes
-- de dar de alta a otra persona).
-- =====================================================================================
begin;

-- #7 · El historial guarda textos de hasta 4000 caracteres y las órdenes tienen tamaño máximo
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

-- #12 · DESCARTADO (decisión de la usuaria, 23-11-2026): se permiten nº de orden repetidos.
-- La app avisa al escribirlo y marca cada una como «1.ª», «2.ª»… No se crea índice único.

-- #13 · Fecha de cierre automática con el «hoy» de España
create or replace function public.set_fecha_cierre() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado = 'FINALIZADA' then
    if new.fecha_cierre is null then new.fecha_cierre = (now() at time zone 'Europe/Madrid')::date; end if;
  else
    new.fecha_cierre = null;
  end if;
  return new;
end; $$;

-- #30 · Quitar permisos que la app no usa
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

-- #35 · Índices en las columnas de enlace
create index if not exists eventos_tipo_idx on public.eventos (tipo);
create index if not exists eventos_created_by_idx on public.eventos (created_by);
create index if not exists tareas_created_by_idx on public.tareas (created_by);
create index if not exists historial_ordenes_created_by_idx on public.historial_ordenes (created_by);
create index if not exists festivos_created_by_idx on public.festivos (created_by);
create index if not exists reglas_plazo_created_by_idx on public.reglas_plazo (created_by);
create index if not exists tipos_cita_created_by_idx on public.tipos_cita (created_by);

commit;

-- Comprobación (informativa): nº de orden repetidos. Están permitidos; la app los marca como «1.ª», «2.ª»…
select lower(btrim(num_orden)) as numero_repetido, count(*) as veces
from public.ordenes group by 1 having count(*) > 1;
