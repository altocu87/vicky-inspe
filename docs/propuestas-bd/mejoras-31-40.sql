-- =============================================================================
-- PROPUESTA (auditoría, punto 35): índices para claves foráneas sin índice.
-- NO es una migración: no se ha aplicado en Supabase. Revisar y aplicar a mano
-- (o copiar a supabase/migrations/) cuando se decida.
--
-- Por qué: Postgres NO crea índice automáticamente en la columna que apunta a
-- otra tabla (clave foránea). Sin índice, al borrar un usuario (on delete set
-- null) o un tipo de cita (on update cascade) tiene que recorrer la tabla
-- entera, y los filtros por esas columnas (p. ej. «mis citas») también.
-- Todos usan «if not exists»: se pueden ejecutar varias veces sin error.
-- =============================================================================

-- ---- Pedidas en la auditoría ------------------------------------------------

-- eventos.tipo -> tipos_cita(id): filtros por tipo y renombrar/borrar un tipo
create index if not exists eventos_tipo_idx on public.eventos (tipo);

-- created_by -> auth.users(id) (on delete set null al borrar un usuario)
create index if not exists eventos_created_by_idx on public.eventos (created_by);
create index if not exists tareas_created_by_idx on public.tareas (created_by);
create index if not exists historial_ordenes_created_by_idx on public.historial_ordenes (created_by);

-- ---- Encontradas al revisar las migraciones ---------------------------------
-- Tablas pequeñas (configuración): el beneficio es mínimo, se incluyen para que
-- ninguna clave foránea quede sin índice. Se pueden omitir sin problema.
create index if not exists festivos_created_by_idx on public.festivos (created_by);
create index if not exists reglas_plazo_created_by_idx on public.reglas_plazo (created_by);
create index if not exists tipos_cita_created_by_idx on public.tipos_cita (created_by);

-- Ya tienen índice (no hace falta nada): ordenes.created_by, eventos.orden_id,
-- eventos.serie_id, tareas.orden_id, historial_ordenes.orden_id (índice
-- compuesto orden_id, momento).

-- ---- Índices parciales: SOLO SI CRECE ---------------------------------------
-- Con el volumen actual no compensan (Postgres lee la tabla entera igual de
-- rápido). Descomentar si las tablas pasan de varios miles de filas y las
-- consultas de series o tareas pendientes se notan lentas.

-- Series repetidas (las que tienen regla de repetición), ordenadas por fecha
-- create index if not exists eventos_series_fecha_idx on public.eventos (fecha) where rrule is not null;

-- Tareas pendientes por fecha de vencimiento
-- create index if not exists tareas_pendientes_vence_idx on public.tareas (vence) where hecha = false;
