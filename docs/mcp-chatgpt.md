# ChatGPT conectado a «Inspecciones» (servidor MCP)

> Guía para la usuaria y memoria técnica. Rama `mcp-chatgpt`. Estado: **programado y probado; NADA activado en producción todavía** (ver «Pasos pendientes»).

## Qué es, en sencillo

Un «servidor MCP» es una puerta para que ChatGPT pueda usar tu app hablando normal:
«¿qué vence esta semana?», «apunta una visita a la orden 2/0004807/26 el domingo a las 10», «dame el informe del mes».

- **Entra con TU usuario** de la app (el mismo correo y contraseña). Las reglas de seguridad de la base de datos (RLS) se aplican igual que en la web.
- **Lo aceptas una vez.** El permiso queda guardado y ChatGPT renueva la sesión él solo. Aunque se actualice el servidor, no hay que desconectar ni volver a conectar (la dirección y la forma de entrar no cambian).
- **Es privado**: sin usuario de tu Supabase no se puede entrar (y el registro de usuarios nuevos está cerrado). Además, la pantalla de permiso solo deja conectar ChatGPT (`chatgpt.com`); cualquier otro programa se rechaza.
- **Nunca puede borrar nada** ni tocar los Ajustes (ni con el servidor ni aunque alguien llamara a la base de datos directamente con tu permiso de ChatGPT: la base de datos lo impide).
- **Privacidad**: lo que consultes desde ChatGPT sale hacia OpenAI. Por defecto solo salen nº de orden, empresa, fechas y estado. Las notas, la situación general, las direcciones y los teléfonos solo salen si los pides expresamente («enséñame las notas de…»).

## Qué puedes pedirle

| Para… | Herramienta | ¿Pide confirmación? |
|---|---|---|
| Buscar órdenes por nº o empresa | `buscar_ordenes` | No (solo lee) |
| Ver una orden (plazos, visitas, tareas) | `ver_orden` | No |
| Ver qué vence (vencidos, esta semana, este mes…) | `plazos` | No |
| Agenda de un día o una semana | `agenda` | No |
| Lo que está «por programar» | `por_programar` | No |
| Próximo domingo o lunes libre | `hueco_visita` | No |
| Festivos de Albacete | `festivos` | No |
| Historial de una orden | `historial_orden` | No |
| Informes: semanal, vencidos, mensual, estadísticas | `informe` | No |
| Dar de alta una orden | `crear_orden` | **Sí** |
| Cambiar datos de una orden | `editar_orden` | **Sí** |
| Cambiar el estado (En curso, Pte. entrega, Devuelta, Finalizada) | `cambiar_estado_orden` | **Sí** |
| Apuntar una visita o cita | `registrar_visita` | **Sí** |
| Marcar visita hecha/fallida (+ detalles) | `marcar_visita` | **Sí** |
| Mover una visita | `mover_visita` | **Sí** |
| Crear una tarea / marcarla hecha | `crear_tarea`, `completar_tarea` | **Sí** |

Al marcar una visita, **la orden no se cambia** (última actuación, estado de la visita) salvo que lo digas expresamente, igual que en la app: ChatGPT te dirá qué se podría actualizar y tú decides.

Ejemplos: «¿Qué tengo el domingo?», «Resumen de la semana», «¿Qué plazos vencen este mes?», «Busca la orden de Talleres Pérez», «Apunta visita a la 2/0004807/26 el próximo domingo libre a las 10:00», «La visita de hoy de Talleres Pérez ha sido fallida: no había nadie», «Estadísticas de 2026».

## Conectarlo en ChatGPT (cuando esté activado)

Hace falta un plan de pago de ChatGPT. Según la ayuda de OpenAI (noviembre de 2026), en **Business/Enterprise/Edu** se pueden usar herramientas que leen y que escriben. En **Plus/Pro** se hace con el «modo desarrollador» y puede que solo se permitan las de **leer**: si es tu caso, consultar e informes funcionarán y los cambios los harás en la app. Los menús de ChatGPT cambian a menudo: si algo no está donde se dice, busca «Aplicaciones», «Conectores» o «Modo desarrollador» en los Ajustes.

**Desde el ordenador (chatgpt.com), una sola vez:**
1. Ajustes → **Aplicaciones** (o «Aplicaciones y conectores») → **Avanzado** → activa **Modo desarrollador** (en Plus/Pro).
2. **Crear** / «Añadir servidor MCP»:
   - Nombre: `Inspecciones`
   - URL: `https://nzhebiuybvmkopzayxsa.supabase.co/functions/v1/mcp`
   - Autenticación: **OAuth** (sin escribir nada más: ChatGPT se registra solo).
3. Pulsa **Crear/Conectar**. Se abre la página de tu app «Conectar ChatGPT»: entra con tu usuario si te lo pide y pulsa **Permitir**. Vuelves a ChatGPT ya conectada.
4. En un chat nuevo, elige «Inspecciones» en el botón **+** (o «Modo desarrollador») y pregunta.

**En el móvil (app de ChatGPT):** las conexiones se añaden desde el ordenador. Una vez conectada, entra en la app del móvil con la misma cuenta de ChatGPT y aparece en el botón **+** del chat. Si te pide permiso, sale la misma página de la app: entra con tu usuario y pulsa **Permitir**.

**Si actualizo el servidor:** no tienes que hacer nada. Solo si añado herramientas nuevas, en ChatGPT → Ajustes → Aplicaciones → Inspecciones → **Actualizar** (no hace falta desconectar).

## Quitar el acceso (por ejemplo, si pierdes el móvil o el ordenador)

1. **En tu app**: Ajustes → **Asistentes conectados** → **Quitar acceso**. Se corta al momento: el servidor comprueba en cada petición que la sesión sigue viva.
2. En ChatGPT: Ajustes → Aplicaciones → Inspecciones → **Desconectar/Eliminar**.
3. Si crees que alguien conoce tu contraseña de la app, cámbiala.
4. Para apagarlo del todo: en Supabase → Authentication → OAuth Server, desactívalo (o pídemelo).

## Cómo está hecho (técnico)

```
ChatGPT ──HTTPS──▶ Supabase Edge Function «mcp» (Deno)          ◀── src/mcp (empaquetado con npm run build:mcp)
                    │ withOAuthProtectedResource  → «inicia sesión en Supabase Auth de la app»
                    │ withSupabase({auth:'user'}) → firma (ES256, JWKS), caducidad y emisor del token
                    │ comprobarIdentidad          → token OAuth (client_id), sesión viva (getUser), lista opcional
                    │ Limitador                   → 60 peticiones/min y 600/hora; cuerpo ≤ 64 KB; respuesta ≤ 15 000 caracteres
                    ▼
                  17 herramientas (src/mcp/lectura.ts, escritura.ts, informes.ts)
                    ▼
                  src/data/supabaseDatos.ts (la MISMA capa de datos que la web) con el cliente de TU sesión → RLS
Pantalla de permiso: vicky-inspe.vercel.app/oauth/consent (src/components/Consentimiento.tsx)
```

- **Reutiliza** `src/lib` (plazos, festivos, semana, por programar, repetición, visitaEstado, historial) y `src/data` (sin copiar código). El servidor solo ve un subconjunto de la capa de datos (`DatosMcp`) **sin ninguna función de borrar ni de ajustes**.
- **«Hoy» siempre en hora de España** (`src/mcp/reloj.ts`, con `Intl` y `Europe/Madrid`): el servidor está en UTC. Probado de madrugada y con cambio de horario.
- **Entradas**: esquemas estrictos de zod (`src/mcp/esquemas.ts`): campos desconocidos rechazados, fechas reales `aaaa-mm-dd`, UUID, longitudes, listas cerradas, sin caracteres de control. `editar_orden` solo acepta una lista blanca de campos.
- **Errores** sin detalles internos. **Registros** sin datos personales (solo herramienta, si fue bien y cuánto tardó).
- **Sin secretos nuevos**: la función usa las variables que pone Supabase (`SUPABASE_URL` y claves públicas). Nunca la clave `service_role`. Opcional: `MCP_CLIENTES_PERMITIDOS` (id del cliente OAuth de ChatGPT) para fijar que solo entre ese.
- **Migración** `20261120090000_mcp_chatgpt.sql`: el historial apunta el origen («app» o «chatgpt») y políticas *restrictive* para que un token de asistente no pueda borrar ni tocar los ajustes.
- **Pruebas**: `src/mcp/mcp.test.ts` (datos inventados de `src/mcp/datosPrueba.ts`), `src/lib/oauth.test.ts` y `src/lib/migraciones.test.ts`.

### Comandos

```bash
npm test              # pruebas (incluye el servidor MCP)
npm run build:mcp     # genera supabase/functions/mcp/index.js (no se sube al repositorio)
```

Despliegue (solo con permiso): `npm run build:mcp` y después `supabase functions deploy mcp --no-verify-jwt` (o la Management API), con `verify_jwt = false` (el propio servidor comprueba el token; la pasarela, si no, rechazaría la petición de descubrimiento de OAuth, que va sin token).

## Pasos pendientes (necesitan el permiso de la usuaria)

1. **Subir la rama a `main`** (Vercel publica la pantalla de permiso `/oauth/consent` y la sección «Asistentes conectados»). No cambia nada de lo que ya hay: mientras el paso 3 no esté hecho, la sección dice «aún no está activada».
2. **Aplicar la migración** `20261120090000_mcp_chatgpt.sql` (probada en la base real dentro de una transacción deshecha: ver el plan).
3. **Activar en Supabase** → Authentication → OAuth Server: *Enable*, *Allow dynamic client registration* y *Authorization path* = `/oauth/consent` (la *Site URL* ya es `https://vicky-inspe.vercel.app`).
4. **Publicar la función** `mcp` (`verify_jwt = false`).
5. **Conectar desde ChatGPT** y probar con una orden de prueba (que luego quitarás tú).
6. (Opcional) Fijar `MCP_CLIENTES_PERMITIDOS` con el id de cliente de ChatGPT (lo saco yo de la base de datos una vez conectado).
