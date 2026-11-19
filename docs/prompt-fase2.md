# Encargo: fase 2 del calendario (vicky-inspe)

Háblame en castellano, sencillo; no soy programador. Explica brevemente qué hace cada parte importante.

## Contexto
- Repositorio `altocu87/vicky-inspe`. Trabaja sobre la rama **`calendario`** (fase 1 terminada) y sube tu trabajo a la rama **`calendario-fase2`**. **NO** subas nada a `main` sin mi permiso.
- **Lee primero `docs/plan-calendario.md`**: es la memoria del proyecto (lo que hay, las decisiones, las respuestas de la usuaria, la auditoría de seguridad y el plan por fases). Mantenlo al día al terminar.
- La app la usa UNA sola persona, una subinspectora de Albacete. El LUNES es su día de oficina; hace las visitas el DOMINGO y el LUNES. Lo que más le preocupa son las FECHAS LÍMITE. **La usa mucho desde el MÓVIL, en la calle.**
- Supabase: el proyecto real es `nzhebiuybvmkopzayxsa` («vicky-inspe»). El conector MCP de Supabase de la sesión es de OTRA cuenta y no lo ve. Usa la Management API (`https://api.supabase.com/v1/projects/nzhebiuybvmkopzayxsa/database/query`, POST `{"query": ...}`, cabecera `Authorization: Bearer proxy-injected`; el proxy pone el token real). Para leer, `"read_only": true`. **Nunca apliques migraciones en producción sin mi permiso**: pruébalas en una transacción `begin; …migración… ; …migración otra vez… ; comprobaciones ; rollback;` y confirma después que no ha quedado nada.
- La migración de la fase 1 (`20261119085251_calendario_fase1.sql`) está probada pero **todavía NO está aplicada**.
- Respuestas de la usuaria: solo hay las dos fechas límite del Excel (ampliables en Ajustes, ya hecho). Tipos de cita: **visita** y **comparecencia**, ampliables desde Ajustes. Festivos: Albacete (ya en la tabla `festivos`). El correo del resumen semanal es para la fase 3 (está en la conversación; no lo escribas en el repositorio).

## SEGURIDAD (obligatorio en cada paso)
Son datos sensibles: el sistema tiene que ser hermético. En cada cambio:
- Las tablas nuevas, con RLS, solo para `authenticated` y `revoke all … from anon`; nada de `security definer` salvo que sea imprescindible y esté justificado. Los CHECK en la base de datos validan longitudes y valores.
- Todo lo que llegue de la base de datos, de la URL o del usuario se valida antes de usarse (mira `combinarReglas` y `leerRuta`). Nunca `dangerouslySetInnerHTML` ni `eval`. Nada de datos reales en capturas ni en pruebas (usa el modo demo `VITE_DEMO=1`).
- Respeta la CSP de `vercel.json` y `seguridad.headers.json`: si FullCalendar u otra librería necesita algo (por ejemplo `style-src`), justifícalo y amplíalo lo mínimo, actualizando la prueba de cabeceras.
- Los enlaces externos («Cómo llegar», «Llamar») se construyen codificando los datos (`encodeURIComponent`) y solo con esquemas permitidos (`https:`, `tel:`), con `rel="noopener noreferrer"`.
- `npm audit` sin vulnerabilidades. Al final, una auditoría escrita en el apartado «Seguridad» del plan.
- Los hallazgos S1-S7 del plan que requieren mi visto bueno no los apliques sin preguntar; recuérdamelos al final.

## Fase 2: qué hay que hacer

### Visitas, tareas y la semana de trabajo
- Tabla `eventos`: título, tipo (visita, comparecencia… ampliable desde Ajustes con una tabla `tipos_cita`), fechas y horas (opcionales), todo el día, ubicación, teléfono opcional, notas, `orden_id` opcional, estado (pendiente / hecha / fallida / cancelada), avisos en minutos, repetición (RRULE sin DTSTART + días quitados + excepciones «solo este» con `serie_id` y `ocurrencia_original`), `origen` ('app' o 'excel').
- Tabla `tareas`: título, notas, `orden_id` opcional, vencimiento, hora y duración opcionales, prioridad, hecha/no hecha, repetición sencilla y la casilla «para la oficina (lunes)».
- **Semana a su medida**: el lunes sale marcado como «Oficina»; el domingo y el lunes se resaltan como días de visita; al programar una visita, el atajo propone el próximo domingo o lunes libre.
- Panel **«Por programar»**: tareas sin fecha y órdenes activas con un plazo a menos de 30 días y sin visita futura, las más urgentes primero. Se arrastran a un día; si se suelta una orden, se crea una visita enlazada. En el móvil, botón «Programar» en cada una en vez de arrastrar.
- Al marcar una visita o actuación como HECHA o FALLIDA, **preguntar** si se actualiza la orden: la última actuación pasa a ese día (y se recalcula el plazo siguiente), y el estado de la visita sigue la secuencia del Excel: SIN VISITA → 1º FALLIDA → 1º FALLIDA, 2º FALLIDA / 1º FALLIDA, REALIZADA → REALIZADA. Nunca la cambies sin preguntar.
- El motor de plazos ya acepta reglas que salen de un evento (`partida: { evento: 'tipo' }` y `ContextoPlazos.eventos`): conéctalo con la tabla `eventos`.

### Conversión de `fecha_visita` (lo heredado del Excel)
- Cada «dd/mm/aaaa» del campo de texto `fecha_visita` se convierte en un evento `visita` enlazado a su orden, con `origen = 'excel'` y una clave única (orden + fecha) para que se pueda repetir sin duplicar. El estado se deduce de `estado_visita` cuando el número de fechas encaja con la secuencia (p. ej. «1º FALLIDA, REALIZADA» con 2 fechas → fallida y hecha); si no, las futuras quedan pendientes y las pasadas hechas. **El texto original NO se toca.** Los casos dudosos (p. ej. «1º visita 19-11-24; 2º visita el 3-12-24», «14/04/2025 FALLIDA», «FALLIDA» sin fecha) salen en una lista para revisarlos a mano. Datos reales: 144 órdenes con fechas, 302 «NO VISITA» y 5 «FALLIDA».
- La lógica de la conversión, pura y con pruebas, en `src/lib`. La conversión se ejecuta como migración/SQL **solo cuando yo lo apruebe**. Enséñame antes el resultado de una simulación (cuántas visitas, cuántas dudosas).
- A partir de entonces, el minicalendario de `OrdenForm` **crea la visita en el calendario** en lugar de escribir texto. El campo de texto se queda como «Notas de visita (Excel)», editable. La tabla, `ListaMovil` y el CSV muestran la «Próxima visita» (sale de los eventos) y el CSV conserva también la columna de texto original.

### Simbiosis tabla ↔ calendario
- Los mismos filtros en las dos vistas (ya hay un solo estado en `App.tsx` / `src/lib/filtros.ts`: úsalo también para eventos y tareas).
- Columna nueva «Próxima visita», con su semáforo, que se puede ordenar y ocultar. Botón «Programar visita» en cada orden, que propone domingo o lunes.
- `OrdenForm` → «Agenda de esta orden»: además de los plazos (ya hechos), sus visitas y tareas, y botones para añadir.
- En el calendario, pulsar cualquier cosa de una orden abre su formulario. Lo que se cambia en un sitio se ve al momento en el otro.
- Exportar CSV: incluye la próxima visita.

### Calendario: vistas y comportamiento
- **FullCalendar v7** (MIT). En la v7 todo va dentro de `@fullcalendar/react` (`/daygrid`, `/timegrid`, `/list`, `/multimonth`, `/interaction`, `/themes/monarch`, `/locales/es`) más `temporal-polyfill`. **No** instales `@fullcalendar/core` ni los paquetes sueltos (son la v6). Para repeticiones, `rrule`. Si una vista de FullCalendar no queda bien en el móvil, hazla a mano.
- Tema «monarch» adaptado con sus variables CSS (`--fc-monarch-…`) usando los tokens de `index.css`, en claro y oscuro. Cada evento con contenido propio (icono + hora + título). Nada de colores sueltos fuera de los ficheros de tokens.
- Vistas: Plazos (ya está), Hoy/Agenda, Día, Semana con horas (solo en el ordenador), Mes y Año. La vista y la fecha se guardan en la URL (`#calendario?vista=…&fecha=…`, validadas en `src/lib/ruta.ts`) y se recuerdan.
- Capas con color, icono, contador y botón para mostrarla u ocultarla: Plazos (todo el día, con el color de su nivel, sin arrastrar), Visitas y citas, Tareas, Hitos de la orden (desactivada por defecto) y Festivos.
- En el ordenador: crear arrastrando sobre un hueco; mover y estirar eventos (si falla al guardar, el evento vuelve a su sitio y se avisa). Ficha rápida con Editar, Duplicar, Eliminar, Abrir la orden y Hecha/Fallida.
- Atajos de teclado en el ordenador: P plazos, D, S, M, G y A el resto de vistas; T hoy; J/K avanzar y retroceder; N crear; / buscar; ? ayuda.

### Móvil (obligatorio, no un extra)
- Arranca en «Hoy / Agenda»: lo de hoy arriba (visitas con hora y dirección, plazos que vencen, tareas) y luego los próximos días.
- Mes: calendario compacto con puntos de color por día; al tocar un día, su lista debajo. Semana: los 7 días en lista, no una rejilla con horas.
- Cambio de periodo deslizando el dedo; botón «+» flotante (sin tapar la barra de abajo ni el contenido); formularios y fichas a pantalla completa o como hoja inferior; objetivos táctiles de al menos 44 px; nada que solo funcione pasando el ratón por encima.
- Ficha de una visita en el móvil: «Cómo llegar» (abre el mapa del teléfono), «Llamar» si hay teléfono, «Hecha» y «Fallida» con un toque (y la pregunta de actualizar la orden).
- Todo lo que se hace arrastrando tiene también un botón equivalente.
- Que cargue rápido con datos móviles: carga eventos y tareas solo del rango visible (más un margen), y FullCalendar con `import()` diferido.

## Trampas conocidas (no las repitas)
- Fin de lo «de todo el día»: FullCalendar lo da EXCLUSIVO y se guarda INCLUSIVO. **Ya existe `src/lib/todoElDia.ts` con pruebas: úsalo, no lo dupliques.**
- Nunca `toISOString()` para sacar el día: usa `src/lib/fechas.ts`.
- Con `rrule`, cada día es la medianoche UTC y se lee con `getUTC*`. Despliega las series solo en el rango visible, con un tope.
- Días hábiles: `src/lib/habiles.ts` (ya con pruebas).

## Base de datos
- Migraciones que se pueden ejecutar dos veces sin romper nada (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` antes de cada política), con fecha y hora reales de 14 cifras (`date +%Y%m%d%H%M%S`). NUNCA borran tablas ni datos; el texto libre del Excel no se toca. Las pruebas de `src/lib/migraciones.test.ts` deben seguir pasando (amplíalas).
- Mismas políticas que `ordenes`: solo usuarios con sesión y `created_by default auth.uid()`.
- Toda lectura y escritura, en `src/data/api.ts` (interfaz `Backend`, con su versión real y la demo).

## Forma de trabajar y cierre de la fase
- La lógica pura (semana de trabajo, «Por programar», repeticiones, conversión de `fecha_visita`, secuencia de estado de visita) en `src/lib`, con pruebas de Vitest.
- Al terminar: `npm run lint`, `npm test` y `npm run build` en verde; pruébalo con Playwright (ya instalado) en el ordenador y en el móvil (375 y 412 px), en claro y en oscuro, con datos de ejemplo (`VITE_DEMO=1 npm run dev`), comprobando que no hay desplazamiento horizontal ni errores de JS, y **enséñame capturas**. Prueba también el build de producción con `npm run preview` para ver que la CSP no bloquea nada.
- Actualiza `docs/plan-calendario.md` y el README. Resúmeme lo hecho en sencillo, recuérdame lo que hay pendiente de mi aprobación (migraciones, conversión de `fecha_visita` y hallazgos de seguridad) y **pregúntame antes de subir nada a `main`**. Si lo subo, comprueba que el despliegue de Vercel y las migraciones han ido bien.
- Al terminar, prepara el encargo de la fase 3 (alertas personalizadas y resumen semanal por correo con una Edge Function de Supabase y pg_cron) en `docs/prompt-fase3.md`, siguiendo el plan.
