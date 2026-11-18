-- Fecha de cierre del expediente, para medir cuánto se tarda en cerrar.
alter table public.ordenes add column fecha_cierre date;

-- Histórico: el Excel no tenía fecha de cierre; se usa la última actuación
-- (solo si no es anterior a la fecha de la orden).
update public.ordenes
set fecha_cierre = fecha_ultima_actuacion
where estado = 'FINALIZADA'
  and fecha_ultima_actuacion is not null
  and (fecha_orden is null or fecha_ultima_actuacion >= fecha_orden);

-- A partir de ahora: al pasar a FINALIZADA se pone la fecha de hoy si no hay otra;
-- si se reabre, se borra.
create or replace function public.set_fecha_cierre() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado = 'FINALIZADA' then
    if new.fecha_cierre is null then new.fecha_cierre = current_date; end if;
  else
    new.fecha_cierre = null;
  end if;
  return new;
end; $$;

create trigger ordenes_fecha_cierre before insert or update on public.ordenes
for each row execute function public.set_fecha_cierre();
