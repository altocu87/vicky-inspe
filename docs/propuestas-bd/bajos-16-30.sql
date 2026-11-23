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
