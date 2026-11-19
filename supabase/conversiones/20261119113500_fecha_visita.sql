-- CONVERSIÓN de `ordenes.fecha_visita` (texto del Excel) en visitas del calendario (`eventos`).
-- ⚠️ NO es una migración automática: está fuera de supabase/migrations a propósito.
--    Se ejecuta UNA vez, a mano (Supabase → SQL Editor), SOLO cuando la usuaria lo apruebe,
--    y DESPUÉS de aplicar la migración 20261119112716_calendario_fase2.sql.
-- - El texto original NO se toca (no hay ningún UPDATE de `ordenes`).
-- - Se puede ejecutar varias veces: cada visita lleva una clave única (orden + fecha) y no se duplica.
-- - Es la misma lógica que src/lib/fechaVisita.ts (probada con Vitest; se comparó con los datos reales).
-- - Los casos dudosos NO se convierten: se listan al final para revisarlos a mano.

-- Función temporal (desaparece al cerrar la sesión). Devuelve una fila por visita,
-- o una sola fila con `dudoso` relleno, o nada si no hay que convertir.
create or replace function pg_temp.convertir_fecha_visita(texto text, estado_visita text, hoy date)
returns table (fecha date, estado text, segun_secuencia boolean, dudoso text, numero int, total int, notas text)
language plpgsql immutable set search_path = '' as $$
declare
  t text := btrim(coalesce(texto, ''), E' \t\r\n');
  u text;
  -- Fecha d/m/aaaa, dd/mm/aaaa, dd-mm-aa… opcionalmente seguida de FALLIDA
  re_fecha constant text := '(?<![0-9])([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4}|[0-9]{2})(?![0-9])([[:space:]]*FALLIDA)?';
  re_solo constant text := '(?<![0-9])([0-9]{1,2})[/-]([0-9]{1,2})[/-]([0-9]{4}|[0-9]{2})(?![0-9])';
  m text[];
  fechas date[] := '{}';
  fallidas date[] := '{}';
  unicas date[];
  palabras text[];
  sec text[];
  est text[];
  segun boolean := true;
  nota text;
  ev text := upper(regexp_replace(btrim(coalesce(estado_visita, '')), '\s+', ' ', 'g'));
  d int; mes int; anio int; i int; f date;
begin
  if t = '' or t ~* '^NO VISITA$' then return; end if;
  u := upper(t);
  for m in select regexp_matches(u, re_fecha, 'g') loop
    d := m[1]::int; mes := m[2]::int;
    anio := case when length(m[3]) = 2 then 2000 + m[3]::int else m[3]::int end;
    if mes < 1 or mes > 12 or d < 1 or d > extract(day from (make_date(anio, mes, 1) + interval '1 month - 1 day'))::int then
      return query select null::date, null::text, null::boolean, 'Fecha imposible: ' || m[1] || '/' || m[2] || '/' || m[3], null::int, null::int, null::text;
      return;
    end if;
    f := make_date(anio, mes, d);
    fechas := fechas || f;
    if m[4] is not null then fallidas := fallidas || f; end if;
  end loop;
  if cardinality(fechas) = 0 then
    return query select null::date, null::text, null::boolean, 'No hay ninguna fecha', null::int, null::int, null::text; return;
  end if;
  select coalesce(array_agg(p), '{}') into palabras
  from regexp_split_to_table(regexp_replace(u, re_solo, ' ', 'g'), '[[:space:],;.–-]+') p where p <> '';
  if exists (select 1 from unnest(palabras) p where p !~ '^(VISITA|EL|Y|FALLIDA|[0-9][ºª])$') then
    return query select null::date, null::text, null::boolean, 'Hay texto que no se entiende', null::int, null::int, null::text; return;
  end if;
  nota := case when cardinality(palabras) > 0 then 'Texto del Excel: «' || t || '»' end;
  select array_agg(x order by x) into unicas from (select distinct unnest(fechas) x) s;
  sec := case ev
    when '' then '{}'::text[]
    when 'SIN VISITA' then '{}'::text[]
    when '1º FALLIDA' then array['fallida']
    when '1º FALLIDA, 2º FALLIDA' then array['fallida', 'fallida']
    when '1º FALLIDA, REALIZADA' then array['fallida', 'hecha']
    when 'REALIZADA' then array['hecha']
    else null end;
  est := array_fill(null::text, array[cardinality(unicas)]);
  for i in 1 .. cardinality(unicas) loop
    if sec is not null and cardinality(sec) > 0 and cardinality(unicas) = cardinality(sec) then
      est[i] := sec[i];
    elsif sec is not null and cardinality(sec) > 0 and cardinality(unicas) = cardinality(sec) + 1 and unicas[cardinality(unicas)] >= hoy then
      est[i] := case when i <= cardinality(sec) then sec[i] else 'pendiente' end;
    else
      segun := false;
      est[i] := case when unicas[i] >= hoy then 'pendiente' else 'hecha' end;
    end if;
    -- «dd/mm/aaaa FALLIDA» manda sobre lo anterior
    if unicas[i] = any (fallidas) then est[i] := 'fallida'; end if;
  end loop;
  for i in 1 .. cardinality(unicas) loop
    return query select unicas[i], est[i], segun, null::text, i, cardinality(unicas), nota;
  end loop;
end; $$;

-- Las visitas convertidas («1ª visita», «2ª visita»… si la orden tiene varias fechas)
insert into public.eventos (titulo, tipo, fecha, todo_el_dia, orden_id, estado, origen, clave_origen, notas)
select case when c.total > 1 then c.numero || 'ª visita (Excel)' else 'Visita (Excel)' end, 'visita', c.fecha, true, o.id, c.estado, 'excel', 'excel:' || o.id || ':' || c.fecha, c.notas
from public.ordenes o
cross join lateral pg_temp.convertir_fecha_visita(o.fecha_visita, o.estado_visita, (now() at time zone 'Europe/Madrid')::date) c
where c.dudoso is null
on conflict (clave_origen) do nothing;

-- Casos dudosos para revisar a mano (no se ha convertido nada de ellos)
select o.num_orden, o.empresa, o.fecha_visita, o.estado_visita, c.dudoso as motivo
from public.ordenes o
cross join lateral pg_temp.convertir_fecha_visita(o.fecha_visita, o.estado_visita, (now() at time zone 'Europe/Madrid')::date) c
where c.dudoso is not null
order by o.num_orden;
