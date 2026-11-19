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
returns table (fecha date, estado text, segun_secuencia boolean, dudoso text)
language plpgsql immutable set search_path = '' as $$
declare
  t text := btrim(coalesce(texto, ''), E' \t\r\n');
  m text[];
  fechas date[] := '{}';
  unicas date[];
  sec text[];
  ev text := upper(regexp_replace(btrim(coalesce(estado_visita, '')), '\s+', ' ', 'g'));
  d int; mes int; anio int; i int;
begin
  if t = '' or t ~* '^NO VISITA$' then return; end if;
  for m in select regexp_matches(t, '(\d{2})/(\d{2})/(\d{4})', 'g') loop
    d := m[1]::int; mes := m[2]::int; anio := m[3]::int;
    if mes < 1 or mes > 12 or d < 1 or d > extract(day from (make_date(anio, mes, 1) + interval '1 month - 1 day'))::int then
      return query select null::date, null::text, null::boolean, 'Fecha imposible: ' || m[1] || '/' || m[2] || '/' || m[3];
      return;
    end if;
    fechas := fechas || make_date(anio, mes, d);
  end loop;
  if cardinality(fechas) = 0 then
    return query select null::date, null::text, null::boolean, 'No hay ninguna fecha dd/mm/aaaa'; return;
  end if;
  if regexp_replace(t, '\d{2}/\d{2}/\d{4}', '', 'g') !~ '^[[:space:],;.–yY-]*$' then
    return query select null::date, null::text, null::boolean, 'Hay texto además de las fechas'; return;
  end if;
  select array_agg(x order by x) into unicas from (select distinct unnest(fechas) x) s;
  sec := case ev
    when '' then '{}'::text[]
    when 'SIN VISITA' then '{}'::text[]
    when '1º FALLIDA' then array['fallida']
    when '1º FALLIDA, 2º FALLIDA' then array['fallida', 'fallida']
    when '1º FALLIDA, REALIZADA' then array['fallida', 'hecha']
    when 'REALIZADA' then array['hecha']
    else null end;
  if sec is not null and cardinality(sec) > 0 and cardinality(unicas) = cardinality(sec) then
    for i in 1 .. cardinality(unicas) loop
      return query select unicas[i], sec[i], true, null::text;
    end loop;
    return;
  end if;
  if sec is not null and cardinality(sec) > 0 and cardinality(unicas) = cardinality(sec) + 1 and unicas[cardinality(unicas)] >= hoy then
    for i in 1 .. cardinality(unicas) loop
      return query select unicas[i], case when i <= cardinality(sec) then sec[i] else 'pendiente' end, true, null::text;
    end loop;
    return;
  end if;
  for i in 1 .. cardinality(unicas) loop
    return query select unicas[i], case when unicas[i] >= hoy then 'pendiente' else 'hecha' end, false, null::text;
  end loop;
end; $$;

-- Las visitas convertidas
insert into public.eventos (titulo, tipo, fecha, todo_el_dia, orden_id, estado, origen, clave_origen)
select 'Visita (Excel)', 'visita', c.fecha, true, o.id, c.estado, 'excel', 'excel:' || o.id || ':' || c.fecha
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
