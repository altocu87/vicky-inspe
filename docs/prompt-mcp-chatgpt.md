# Prompt maestro: servidor MCP de «Inspecciones» (vicky-inspe) para usarlo desde ChatGPT

> Cómo usarlo: copia TODO este documento como primer mensaje de una sesión nueva de Claude Code
> sobre el repositorio `altocu87/vicky-inspe`. Está pensado para que el trabajo se haga por fases,
> con pruebas y pidiendo permiso antes de tocar nada real.

---

Háblame en castellano, sencillo; no soy programadora. Explica brevemente qué hace cada parte importante.

## Objetivo
Quiero un **servidor MCP** (Model Context Protocol) para conectar **ChatGPT** a mi app de órdenes de inspección, de modo que desde ChatGPT pueda, hablando normal:
- **Consultar**: buscar órdenes, ver una orden con sus plazos, visitas, tareas e historial; ver qué vence (vencidos, esta semana, este mes); ver la agenda de un día o una semana; ver lo que está «por programar».
- **Crear y editar**: dar de alta una orden, cambiar datos o el estado (EN CURSO, PTE ENTREGA, DEVUELTA, FINALIZADA), registrar visitas y citas, marcarlas como hechas o fallidas con detalles, mover una visita, crear y completar tareas.
- **Informes**: resumen semanal (lo de la semana que viene: plazos, visitas del domingo y el lunes, tareas para la oficina), vencidos, estadísticas por mes (órdenes recibidas, cerradas, días medios para cerrar, visitas hechas y fallidas).
- **Calendario**: proponer el próximo domingo o lunes libre para una visita, y ver los festivos de Albacete.

## Antes de nada: lee el proyecto
- `docs/plan-calendario.md`: la memoria del proyecto (decisiones, auditorías de seguridad, estado). Mantenla al día.
- La lógica ya existe y está probada en `src/lib` (TypeScript puro, sin React): **reutilízala, no la copies ni la reescribas**:
  `plazos/motor.ts` y `plazos/reglas.ts` (fechas límite), `habiles.ts` y `festivosAlbacete.ts`, `semana.ts` (oficina el lunes; visitas domingo y lunes; próximo hueco libre), `porProgramar.ts`, `repeticion.ts`, `visitaEstado.ts` (secuencia del estado de la visita y propuesta de cambios en la orden), `historial.ts`, `eventos.ts` / `tareas.ts` (validación de filas con `leerEvento`, `leerTarea`, lista blanca de campos con `soloCampos`), `fechas.ts` (fechas locales; **nunca** `toISOString()` para sacar el día).
- Base de datos (Supabase, proyecto `nzhebiuybvmkopzayxsa`): tablas `ordenes`, `eventos`, `tareas`, `tipos_cita`, `festivos`, `reglas_plazo` e `historial_ordenes` (este último lo escribe solo un disparador). Todas con RLS solo para `authenticated`. Mira las migraciones en `supabase/migrations`.
- Acceso a Supabase desde la sesión: Management API (`https://api.supabase.com/v1/projects/nzhebiuybvmkopzayxsa/database/query`, POST `{"query": ...}`, cabecera `Authorization: Bearer proxy-injected`; para leer, `"read_only": true`). **Nunca apliques migraciones, ni crees secretos, ni despliegues nada en producción sin mi permiso.** Prueba las migraciones dentro de una transacción `begin; … ; rollback;`.

## AVISO IMPORTANTE (dímelo antes de empezar)
Estos datos son de inspección y sensibles. Usar ChatGPT significa que **lo que se consulte saldrá hacia OpenAI**. Antes de programar nada:
1. Recuérdame que compruebe si mi organismo permite usar ChatGPT con estos datos (deber de sigilo, protección de datos, política de uso de IA de mi administración) y con qué tipo de cuenta (por ejemplo, si existe una cuenta corporativa con garantías de no entrenamiento).
2. Propón cómo **minimizar** lo que sale: por defecto, respuestas con lo justo (nº de orden, empresa, fechas, estado); nada de notas libres salvo que las pida expresamente.
No sigas hasta que te confirme que puedo usarlo.

## Investiga primero (no lo des por supuesto)
Comprueba con la documentación ACTUAL (estas cosas cambian deprisa) y dime lo que encuentres en sencillo:
- Cómo conecta **ChatGPT** con un servidor MCP propio (conectores personalizados / modo desarrollador): qué plan de ChatGPT hace falta, qué transporte exige (HTTP «streamable» remoto por HTTPS) y qué **autenticación** (OAuth 2.1, registro dinámico de clientes, etc.).
- Cómo hacer que la autenticación sea **la mía de la app** (mi usuario de Supabase), por ejemplo con el servidor OAuth de Supabase Auth si está disponible, para que el servidor actúe **con mi sesión** y las políticas RLS se sigan aplicando.
- Dónde alojarlo: **Supabase Edge Function** (Deno, misma base de datos, sin servidores nuevos) o **Vercel** (función de Node junto a la web). Compara coste, sencillez y seguridad y recomiéndame una.
- El SDK oficial de MCP para TypeScript y cómo declarar herramientas con sus anotaciones (solo lectura, destructiva…).

## Diseño que espero (ajústalo a lo que investigues y explícamelo antes de programar)
- **Herramientas de lectura** (marcadas como solo lectura): `buscar_ordenes`, `ver_orden`, `plazos` (rango y nivel), `agenda` (rango), `por_programar`, `hueco_visita`, `festivos`, `historial_orden`, `informe` (semanal / vencidos / mensual / estadísticas).
- **Herramientas de escritura** (ChatGPT debe pedirme confirmación antes de cada una): `crear_orden`, `editar_orden` (solo campos de una lista blanca), `cambiar_estado_orden`, `registrar_visita` (orden, día, hora, dirección, teléfono, detalles), `marcar_visita` (hecha/fallida + detalles; la actualización de la orden —última actuación, estado de la visita— **solo si yo lo digo expresamente**, igual que en la app), `mover_visita`, `crear_tarea`, `completar_tarea`.
- **Sin herramientas de borrar** (ni de órdenes, ni de visitas, ni de tareas) y **sin ninguna herramienta que ejecute SQL libre**.
- Cada herramienta: entrada validada con un esquema estricto (tipos, longitudes, fechas `aaaa-mm-dd` reales, UUID, valores de listas cerradas); salida pequeña y en texto claro en castellano; errores sin detalles internos.
- Toda lectura y escritura pasa por una capa de datos (como `src/data/api.ts` en la web), nunca consultas sueltas por el código.
- Fechas y «hoy» siempre en hora de **Europe/Madrid** (el servidor estará en UTC).

## SEGURIDAD (obligatorio en cada paso)
- El servidor actúa **con mi usuario** (mi token), **nunca** con la clave `service_role`. RLS se sigue aplicando. Si un token caduca o no es válido → error y nada más.
- Solo se aceptan peticiones autenticadas por OAuth; sin «modo abierto» ni enlaces secretos en la URL. Comprueba el origen y la audiencia del token.
- Secretos solo como secretos del alojamiento (Supabase o Vercel), **jamás** en el repositorio.
- Límite de peticiones por minuto y de tamaño de respuesta; registros (logs) sin datos personales.
- Lo que se cambie desde ChatGPT queda en el historial de la orden (ya lo hace el disparador de `historial_ordenes`). Valora añadir de dónde viene el cambio («app» o «chatgpt») con una migración pequeña.
- `npm audit` sin vulnerabilidades. Al final, auditoría escrita en el apartado «Seguridad» del plan, con los riesgos que queden.

## Pruebas
- Pruebas automáticas (Vitest) de cada herramienta con datos INVENTADOS (nunca reales): validación de entradas, permisos, que las de lectura no escriben, que las de escritura solo tocan los campos permitidos, fechas con la hora de España.
- Prueba la conexión con el **MCP Inspector** y después, con mi permiso, desde ChatGPT con una orden de prueba que luego quitaré yo.
- `npm run lint`, `npm test` y `npm run build` en verde.

## Forma de trabajar
1. Aviso de privacidad y mi confirmación.
2. Investigación y propuesta de arquitectura en sencillo (dónde se aloja, cómo entro, qué herramientas). Espera mi visto bueno.
3. Primero solo **lectura**; lo pruebo; después **escritura**; después **informes**.
4. Trabaja en una rama nueva (`mcp-chatgpt`) y **no subas nada a `main`, no apliques migraciones, no crees secretos ni despliegues sin preguntarme**.
5. Al terminar: instrucciones paso a paso, con capturas si hace falta, para conectarlo en ChatGPT desde el ordenador y el móvil; y cómo desconectarlo o revocar el acceso si lo pierdo.
