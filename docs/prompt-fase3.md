# Encargo: fase 3 del calendario (vicky-inspe): alertas y resumen semanal por correo

Háblame en castellano, sencillo; no soy programador. Explica brevemente qué hace cada parte importante.

## Contexto
- Repositorio `altocu87/vicky-inspe`. Trabaja sobre la rama **`calendario-fase2`** (fases 1 y 2 terminadas; si ya se han subido a `main`, parte de `main`) y sube tu trabajo a la rama **`calendario-fase3`**. **NO** subas nada a `main` sin mi permiso.
- **Lee primero `docs/plan-calendario.md`**: es la memoria del proyecto (lo hecho en las fases 1 y 2, decisiones, respuestas de la usuaria, auditorías de seguridad y pendientes). Mantenlo al día al terminar.
- La app la usa UNA sola persona, una subinspectora de Albacete. El LUNES es su día de oficina; visita el DOMINGO y el LUNES. Lo que más le preocupa son las FECHAS LÍMITE. La usa mucho desde el MÓVIL.
- Supabase: proyecto real `nzhebiuybvmkopzayxsa` («vicky-inspe»). El conector MCP de Supabase de la sesión es de OTRA cuenta y no lo ve. Usa la Management API (`https://api.supabase.com/v1/projects/nzhebiuybvmkopzayxsa/database/query`, POST `{"query": ...}`, cabecera `Authorization: Bearer proxy-injected`; el proxy pone el token real). Para leer, `"read_only": true`. **Nunca apliques migraciones en producción sin mi permiso**: pruébalas en una transacción `begin; …migración… ; …otra vez… ; comprobaciones ; rollback;` (para ver resultados dentro de la transacción, usa un `raise exception` con los datos) y confirma después que no ha quedado nada. En la sesión hay PostgreSQL 16 instalado: puedes probar antes en una base local con un esquema `auth` simulado.
- Antes de empezar, comprueba qué migraciones están aplicadas (`supabase_migrations.schema_migrations`): las de las fases 1 y 2 (`20261119085251`, `20261119112716`) puede que aún no. La conversión de `fecha_visita` (`supabase/conversiones/`) solo se ejecuta con mi permiso.
- El correo de destino del resumen me lo pidió la otra sesión y está en la conversación de la fase 1: **pídemelo a mí**; se guarda en la tabla `preferencias`, **nunca** en el repositorio.

## SEGURIDAD (obligatorio en cada paso)
Son datos sensibles: el sistema tiene que ser hermético. En cada cambio:
- Tablas nuevas con RLS, solo para `authenticated` y `revoke all … from anon`; CHECKs de longitudes y valores. `security definer` solo si es imprescindible, justificado, con `set search_path = ''` y sin exponerlo a `anon`.
- La Edge Function: verifica quién la llama (el cron con un secreto propio en la cabecera, o el usuario con su JWT para «Enviármelo ahora»); nunca expongas la `service_role` al navegador; los secretos (clave de Resend, secreto del cron) solo como secretos de Supabase, jamás en el repositorio. Limita a quién se envía: solo a la dirección guardada en `preferencias`.
- El correo no debe llevar más datos de los necesarios (empresa, nº de orden, fecha y tipo de plazo; nada de notas libres). Escapa todo lo que se meta en el HTML del correo.
- Todo lo que llegue de la base de datos, de la URL o del usuario se valida (mira `leerEvento`, `combinarReglas`, `leerRuta`). Nunca `dangerouslySetInnerHTML` ni `eval`. Nada de datos reales en capturas ni en pruebas (modo demo `VITE_DEMO=1`).
- Respeta la CSP de `vercel.json` y `seguridad.headers.json` (si las notificaciones o un service worker necesitan algo, justifícalo, amplíalo lo mínimo y actualiza la prueba de cabeceras).
- `npm audit` sin vulnerabilidades. Al final, auditoría escrita en el apartado «Seguridad» del plan.
- Los hallazgos S1-S7 del plan que requieren mi visto bueno no los apliques sin preguntar; recuérdamelos al final.

## Fase 3: qué hay que hacer (ver el plan)
- **Migraciones**: `avisos_orden` (aviso extra, silenciar y posponer por orden/plazo), `avisos_enviados` (para no repetir un aviso) y `preferencias` (correo, día y hora del resumen, recordatorio del domingo sí/no, avisos del navegador sí/no). Mismas reglas que las anteriores (repetibles, sin borrar nada, pruebas en `src/lib/migraciones.test.ts`).
- **Lógica pura** en `src/lib` con pruebas: `avisos.ts` (qué avisos tocan hoy según los días de aviso de cada regla —`Regla.avisos`— y los minutos de aviso de cada cita —`Evento.avisos`—, sin repetir lo ya enviado, respetando silenciar/posponer) y `resumen.ts` (contenido del resumen semanal: plazos vencidos y de la semana que viene, visitas del domingo y el lunes con dirección, tareas para la oficina, órdenes «por programar»). Reutiliza `plazos/motor.ts`, `porProgramar.ts`, `semana.ts` y `repeticion.ts`; no dupliques cálculos.
- **Campana dentro de la app** con los avisos pendientes (y desde ahí, silenciar o posponer). **Notificaciones del navegador o del móvil** solo si las acepta.
- **Edge Function `resumen-semanal`** (Deno) que reutiliza `src/lib` (mismo cálculo de plazos que la web) y envía con **Resend** (te diré cómo crear la cuenta y la clave; guárdala con `supabase secrets`). Programada con **pg_cron + pg_net** (hay que activar las extensiones: pídeme permiso): por defecto el **sábado por la tarde**, ajustable en Ajustes, y recordatorio opcional el **domingo por la noche**. Botón **«Enviármelo ahora»** en Ajustes. Si la semana está vacía, no se manda nada. Registra los envíos en `avisos_enviados`.
- **Prueba** que compara los plazos que calcula la Edge Function con los de la web (mismas fechas para las mismas órdenes y reglas, incluidos festivos y reglas que cuentan desde una cita).

## Trampas conocidas (no las repitas)
- Fin de lo «de todo el día»: FullCalendar lo da EXCLUSIVO y se guarda INCLUSIVO: usa `src/lib/todoElDia.ts`.
- Nunca `toISOString()` para sacar el día: usa `src/lib/fechas.ts`. En la Edge Function, la zona horaria es **Europe/Madrid** (el servidor está en UTC): calcula «hoy» en hora de España.
- Con `rrule`, cada día es la medianoche UTC y se lee con `getUTC*`; despliega las series solo en el rango necesario, con tope (`desplegar` en `src/lib/repeticion.ts`).
- Días hábiles: `src/lib/habiles.ts`. Festivos: tabla `festivos` (faltan las fiestas locales de Albacete de 2027).
- En `useEffect`, depende de las funciones estables del estado de la agenda (`cargarRango`, `cargarOrden`…), no del objeto entero: provocaba un bucle de recargas.

## Forma de trabajar y cierre de la fase
- Toda lectura y escritura de la web, en `src/data/api.ts` (versión real y demo).
- Al terminar: `npm run lint`, `npm test` y `npm run build` en verde; prueba con Playwright en el ordenador y en el móvil (375 y 412 px), en claro y oscuro, con `VITE_DEMO=1`, sin desplazamiento horizontal ni errores de JS, y **enséñame capturas** (también de cómo se ve el correo, con datos inventados). Prueba el build con `npm run preview` para ver que la CSP no bloquea nada.
- Actualiza `docs/plan-calendario.md` y el README. Resúmeme lo hecho en sencillo, recuérdame lo pendiente de mi aprobación (migraciones, extensiones, secretos, conversión de `fecha_visita` si sigue pendiente y hallazgos de seguridad) y **pregúntame antes de subir nada a `main`**. Si lo subo, comprueba que el despliegue de Vercel, las migraciones y el primer envío programado han ido bien.
- Al terminar, prepara el encargo de la fase 4 (extras: iCal privado, alta en lenguaje normal, plantillas y estadísticas) en `docs/prompt-fase4.md`, siguiendo el plan.
