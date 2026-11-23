# Plan: calendario integrado con las órdenes

> Documento vivo: sirve de memoria entre sesiones. Se actualiza al cerrar cada fase.
> Estado: **Servidor MCP para ChatGPT ACTIVADO en producción el 20-11-2026 (con su permiso): en `main`, migración aplicada, OAuth Server activado y función `mcp` publicada. Falta conectarlo desde ChatGPT: su plan (Go) no permite servidores propios (ver 3 ter).** **Fases 1 y 2 TERMINADAS y PUBLICADAS (subidas a `main` el 19-11-2026 con su permiso; despliegue de Vercel correcto). Migraciones de las fases 1 y 2 APLICADAS en producción el 19-11-2026 (con su permiso). Conversión de `fecha_visita` ejecutada el 19-11-2026 (ver 3 bis).**

## 0. Lo que hay hoy (comprobado el 19-11-2026)

| Tema | Cómo está |
|---|---|
| Base | React 19, Vite 6 y TypeScript 5.8, sin librería de componentes |
| Estilos | `src/index.css` (tokens M3: `--primary`, `--sc-low`, `--shape-m`, `--spring-fast`…), `src/colores.css` (estados), `tabla.css`, `estadisticas.css`; oscuro con `prefers-color-scheme` |
| Datos | Supabase, tabla `ordenes` con RLS (solo `authenticated`), `created_by default auth.uid()`, disparadores `set_updated_at` y `set_fecha_cierre` |
| Plazos | `src/lib/ordenes.ts`: `edate`, `plazo9Meses`, `plazoSiguiente`, `nivel`, `peorNivel`, `diasMinimos`; fechas locales con `parse`/`toIso` |
| Pantallas | `App.tsx`: `Panel` con hash `#estadisticas`, `usePref` (claves `vi:`), `useMobile` (720 px) |
| Tabla | `TablaOrdenes` + `ListaMovil` + `ColumnasMenu`; `OrdenCard`, `OrdenForm`, `ConfirmDelete`, `Plazo` |
| Filtros | Viven dentro de `Panel` (`q`, `filtro`, `ocultarFin`, `sort`) |
| Texto libre | `fecha_visita`, `estado_visita`, `tareas_pendientes` |
| Pruebas | Ninguna (no hay Vitest) |

**Detalles que he encontrado al leerlo**
1. **Niveles**: en el código «urgente» es **≤ 30 días** y «medio» **≤ 90**, no «< 30». Lo mantengo tal cual, para que no cambie nada de lo que ya ve ella.
2. **CSV**: el nombre del fichero usa `toISOString()` (la trampa conocida: después de medianoche puede salir el día anterior). Lo corrijo en la fase 1.
3. La migración `20261118210000` borró y recreó `ordenes` (entonces estaba vacía). Las migraciones nuevas **no** borrarán nada.
4. **Supabase**: con mi acceso veo dos proyectos (`altocu87's Project` y `agenda-mcp-pruebas`) y en ninguno está la tabla `ordenes`. Necesito saber cuál es el proyecto real (pregunta 2.6).
5. FullCalendar **7.1.5** es la versión actual en npm y trae `daygrid`, `timegrid`, `list`, `multimonth`, `interaction` y `locales/*` dentro de `@fullcalendar/react`. Las otras librerías: `rrule` 2.8.1, `temporal-polyfill` 1.0.8, `vitest` 5.1.1.

## 1. Arquitectura (cómo se va a organizar)

```
src/lib/                    ← lógica pura, con pruebas de Vitest
  fechas.ts                 parse/toIso/edate/diasHasta (sale de ordenes.ts, que lo reexporta)
  habiles.ts                días hábiles y festivos
  plazos/reglas.ts          LISTA de reglas de plazo (el único sitio donde se definen)
  plazos/motor.ts           calcula los plazos de una orden a partir de las reglas
  avisos.ts                 qué avisos tocan hoy, sin repetir
  semana.ts                 semana de trabajo (oficina el lunes, visitas domingo y lunes, próximo hueco)
  porProgramar.ts           panel «Por programar»
  resumen.ts                contenido del correo semanal
  rrule.ts                  repeticiones desplegadas en el rango visible (en UTC, con tope)
  todoElDia.ts              fin exclusivo de FullCalendar ↔ fin inclusivo guardado
  filtros.ts                filtros compartidos tabla ↔ calendario
src/data/api.ts             ÚNICO módulo que lee y escribe en Supabase
src/state/                  un solo estado (contexto) con órdenes, eventos, tareas y filtros
src/components/calendario/  pantalla #calendario y sus vistas
supabase/functions/resumen-semanal/   Edge Function (reutiliza src/lib/plazos)
```

**Qué es cada pieza, en sencillo**
- **Reglas de plazo**: una lista del tipo «nombre, desde qué fecha, cuánto se suma, tope, a qué estados». La pantalla no sabe qué reglas hay: lo pregunta al motor. Añadir una regla es añadir una línea a la lista (o una fila en Ajustes).
- **Motor**: recibe una orden (y sus eventos) y devuelve sus plazos con fecha, días que quedan, nivel y si cae en fin de semana o festivo.
- **api.ts**: el único sitio que habla con la base de datos, para que no haya consultas repartidas por las pantallas.
- **Estado único**: los filtros (estado, «urgentes», «sin tiempo», búsqueda) se sacan de `Panel` a un contexto. Así, tabla, tarjetas y calendario usan la misma copia.

## 2. Preguntas antes de empezar (necesito tus respuestas)

1. **Otras fechas límite del Excel.** Además de «9 meses desde la 1.ª actuación» y «5 meses desde la última, con tope de 9 meses», ¿había otras? Para cada una: nombre, fecha de partida, cuánto se suma (días naturales, días hábiles o meses), tope y a qué estados aplica. No me invento ninguna.
2. **`fecha_visita` heredado.** ¿Convierto lo escrito ahí en visitas con fecha? Copiaría solo lo que se entienda claramente como fecha y nunca tocaría el texto original. Lo dudoso saldría en una lista para revisarlo a mano.
3. **Tipos de cita.** Propongo: Visita, Comparecencia, Requerimiento, Llamada, Reunión y Otro. ¿Quitas o añades alguno? ¿Alguno arranca un plazo (por ejemplo, «X días desde el requerimiento»)?
4. **Festivos.** ¿De qué comunidad autónoma y localidad?
5. **Correo.** ¿A qué dirección le llega el resumen? (Propuesta de servicio en la fase 3: **Resend**, gratis hasta 3.000 correos al mes. Tendrías que crear la cuenta, sacar una clave y guardarla como secreto en Supabase. Te lo daré paso a paso.)
6. **Proyecto de Supabase.** ¿En qué proyecto está la tabla `ordenes`? No la encuentro en los dos a los que tengo acceso.

## 2 bis. Respuestas (19-11-2026, confirmadas por la usuaria)

1. **Otras fechas límite**: «ninguna que recuerde». Se monta el sistema de reglas (ampliable desde Ajustes), pero arranca **solo** con «Límite 9 meses» y «Siguiente actuación».
2. **`fecha_visita`**: comprobado en el código. El minicalendario de `OrdenForm` (`anadirFechaVisita`) **añade** «dd/mm/aaaa» al final del texto, por eso puede haber varias fechas y notas como «NO VISITA».
   - **Conversión** (fase 2, una sola vez y repetible sin duplicar): cada «dd/mm/aaaa» se convierte en un evento `visita` enlazado a su orden, con `origen = 'excel'` y una clave única (orden + fecha) para no repetirlo. Estado: se deduce de `estado_visita` cuando el número de fechas encaja con la secuencia (p. ej. «1º FALLIDA, REALIZADA» con 2 fechas → fallida y hecha); si no, futura → pendiente y pasada → hecha. Los casos dudosos van a una lista para revisarlos. **El texto original no se toca.**
   - **A partir de entonces** (propuesta): el minicalendario del formulario **crea la visita en el calendario** y deja de escribir texto. El campo de texto se queda como «Notas de visita (Excel)», editable, para lo heredado y para notas como «NO VISITA». La tabla, la lista del móvil y el CSV muestran «Próxima visita» (sale de los eventos), y el CSV conserva también la columna de texto original.
3. **Tipos de cita**: `visita` y `comparecencia` (los del Excel). La lista se puede ampliar desde Ajustes (tabla `tipos_cita`).
4. **Festivos**: Albacete. Nacionales, más autonómicos de Castilla-La Mancha, más locales de Albacete capital. Se cargan por año en la tabla `festivos` (con su ámbito) y se editan en Ajustes. Cada año se revisan con el BOE, el DOCM y el BOP de Albacete; no se inventan.
5. **Correo**: dirección recibida. Se guardará en la tabla `preferencias` y **no** se escribe en el repositorio.
6. **Proyecto de Supabase**: `vicky-inspe` (ref `nzhebiuybvmkopzayxsa`), en otra cuenta. Acceso desde aquí con un token de la Management API guardado como secreto del entorno.

**Datos reales (consulta de solo lectura, 19-11-2026)**: 457 órdenes. `fecha_visita`: 144 con fechas «dd/mm/aaaa», 302 «NO VISITA», 5 «FALLIDA», 1 «14/04/2025 FALLIDA» y 1 con formato «19-11-24» (este va a la lista de dudosos). `estado_visita`: SIN VISITA 308, REALIZADA 104, 1º FALLIDA 35, 1º FALLIDA y 2º FALLIDA 5, 1º FALLIDA y REALIZADA 4, vacío 1. Extensiones: **no están ni `pg_cron` ni `pg_net`**; se activan en la fase 3. Migraciones aplicadas: las 3 del repositorio.

## 3. Fases

### Fase 1: reglas de plazo, vista Plazos y unión básica con la tabla
- Vitest, más pruebas de `edate`, días hábiles y fin «de todo el día».
- `fechas.ts`, `habiles.ts`, reglas y motor. Las dos reglas de hoy pasan al nuevo formato, con pruebas que comparan fecha a fecha con `plazo9Meses`/`plazoSiguiente`, incluidos los finales de mes (31 → 28/29, bisiestos).
- Migración: tablas `festivos` y `reglas_plazo` (configuración: activa y días de aviso por regla). Las reglas base viven en el código; la tabla solo guarda ajustes.
- `api.ts` y estado compartido de filtros.
- Pantalla `#calendario` (mismo mecanismo que `#estadisticas`) con la **vista Plazos** hecha a mano: grupos Vencidos / Esta semana / La siguiente / Este mes / Después; filtros por tipo y nivel; marca de fin de semana o festivo; al pulsar, se abre la orden. En el móvil, tarjetas grandes.
- Tabla, tarjetas y `ListaMovil`: columna «Próximo plazo» (que se puede ordenar y ocultar) e icono «Ver en el calendario» (`#calendario?orden=id`). El CSV añade el próximo plazo.
- `OrdenForm`: apartado «Agenda de esta orden» (de momento, solo sus plazos).


#### Fase 1: hecho (19-11-2026)
- **Lógica pura** (`src/lib`): `fechas.ts` (fechas locales, `edate`, semanas), `habiles.ts` (días hábiles y motivo del día inhábil), `festivosAlbacete.ts` (festivos verificados), `plazos/reglas.ts` (las reglas y su validación al leerlas de la BD), `plazos/motor.ts` (cálculo, topes en cadena sin bucles, reglas que salen de un evento, que es el punto de enganche de la fase 2), `plazos/lista.ts` (vista Plazos), `filtros.ts` (filtros compartidos), `todoElDia.ts` (fin exclusivo ↔ inclusivo), `ruta.ts` (pantalla por `#`, validada).
- **Pruebas (Vitest, 52)**: las dos reglas del Excel dan EXACTAMENTE las mismas fechas que antes (más de 16 000 combinaciones contra una copia literal del código anterior); `peorNivel` y `diasMinimos` también. Días hábiles con festivos (puente de diciembre y Semana Santa de 2027). Cambio de hora. Todo el día. Agrupación. Ruta manipulada. Migraciones (no borran, RLS, `drop policy if exists`, nada para `anon`, festivos del SQL = los de `festivosAlbacete.ts`). Cabeceras de seguridad.
- **Datos**: `src/data/api.ts` es el único acceso (`supabaseBackend.ts` real; `demo.ts` solo en desarrollo con `VITE_DEMO=1`, y no llega al build de producción, comprobado). Columnas pedidas explícitamente y festivos solo de año−1 a año+2.
- **Migración** `20261119085251_calendario_fase1.sql`: tablas `festivos` (26 festivos 2026-2027) y `reglas_plazo` (ajustes de las reglas base + reglas personalizadas, con CHECKs; `base` solo para `lim9`/`sig`). **Probada en la BD real dentro de una transacción deshecha, ejecutándola 2 veces**: OK, `anon` no puede leer, RLS activa y 8 políticas. **No aplicada todavía.**
- **Pantallas**: `#calendario` (vista Plazos hecha a mano: grupos, filtros por nivel y tipo, marca de inhábil y tarjetas grandes en el móvil), `#calendario?orden=id`, `#ajustes` (festivos por año con aviso si faltan los locales; reglas: activar/desactivar, crear y borrar). Tabla: columna «Próximo plazo» (se puede ordenar y ocultar) e icono «Ver en el calendario»; también en las tarjetas y en `ListaMovil`. `OrdenForm`: apartado «Agenda de esta orden». CSV: próximo plazo, nombre del fichero sin `toISOString` y protección contra la inyección de fórmulas. Navegación: segmentado Órdenes/Calendario en el ordenador y barra inferior en el móvil (el FAB queda por encima de ella).
- **Seguridad**: `vercel.json` con CSP estricta, `X-Frame-Options: DENY`, HSTS, `no-referrer` y `Permissions-Policy`; probada con el build de producción en Chromium sin ninguna violación de la CSP. Mensajes de error sin detalles internos.
- **Navegador**: ordenador, 375 y 412 px, claro y oscuro: sin desplazamiento horizontal, objetivos táctiles ≥ 44 px y sin errores de JS.

#### Pendiente / a tener en cuenta
- **Fiestas locales de Albacete 2027**: aún no publicadas; añadirlas en Ajustes (la app avisa).
- **Al subir a `main`**: aplicar la migración en Supabase (proyecto `nzhebiuybvmkopzayxsa`) ANTES o justo con el despliegue. Si la web nueva llega antes que la migración, funciona igual con los festivos incluidos y las reglas base (está preparado), pero no se podrá guardar en Ajustes.
- La CSP permite conectar solo con `nzhebiuybvmkopzayxsa.supabase.co`: si algún día cambia el proyecto, hay que cambiar `vercel.json` y `seguridad.headers.json`.
- En Vercel las variables solo están en «Production»: las vistas previas de las ramas no tienen datos.

### Fase 2: calendario con visitas y tareas, y «Por programar»
- Migraciones: `eventos` (con repetición RRULE, días quitados y excepciones) y `tareas` (con «para la oficina (lunes)»).
- FullCalendar v7 con el tema monarch adaptado a los tokens. Vistas: Hoy/Agenda (a mano), Día, Semana con horas (solo ordenador; en el móvil, lista de 7 días), Mes (en el móvil, compacto con puntos), Año, y Plazos.
- Capas: Plazos, Visitas y citas, Tareas, Hitos de la orden (apagada al empezar) y Festivos.
- Semana a su medida: lunes «Oficina», domingo y lunes resaltados, atajo «próximo domingo o lunes libre».
- Panel «Por programar»: se arrastra en el ordenador y hay botón «Programar» en el móvil.
- Ficha rápida con Editar, Duplicar, Eliminar, Abrir orden y Hecha/Fallida. En el móvil, además, «Cómo llegar» y «Llamar».
- Al marcar Hecha o Fallida: **pregunta** si actualizar la última actuación y el estado de la visita (secuencia del Excel).
- Columna «Próxima visita», botón «Programar visita» y la agenda completa en `OrdenForm`.
- Crear arrastrando, mover y estirar (si falla al guardar, el evento vuelve a su sitio y se avisa) y atajos de teclado.
- Conversión de `fecha_visita`, si dices que sí (pregunta 2.2).

#### Fase 2: hecho (19-11-2026)
- **Lógica pura** (`src/lib`, con pruebas): `eventos.ts` (validación de cada fila, tipos de cita, enlaces «Cómo llegar»/«Llamar» seguros), `tareas.ts` (repetición sencilla: al hacerla pasa a la siguiente fecha), `repeticion.ts` (RRULE en UTC, solo el rango visible, tope de 1000; excepciones «solo este» y días quitados) y `repeticionTexto.ts`, `semana.ts` (lunes oficina, domingo y lunes de visita, próximo domingo o lunes libre: no festivo y con menos de 4 visitas pendientes; tareas «para la oficina»), `porProgramar.ts` (órdenes activas con plazo a < 30 días o vencido y sin visita futura, más tareas sin fecha; semáforo de la próxima visita), `visitaEstado.ts` (secuencia del Excel y propuesta de cambios en la orden), `fechaVisita.ts` (conversión del texto del Excel), `capas.ts` (lo que se pinta, por capas y con los mismos filtros que la tabla), `ruta.ts` (vista y fecha en la URL, validadas). **Pruebas: 110** (antes 52).
- **Motor de plazos**: conectado con `eventos`. Una regla creada en Ajustes puede contar «desde la última cita de un tipo» (partida `evento:<tipo>`; cuentan las citas no canceladas). La migración amplía el CHECK de `reglas_plazo.partida`.
- **Migración** `20261119112716_calendario_fase2.sql`: `tipos_cita` (visita y comparecencia), `eventos` y `tareas`, con RLS solo para `authenticated`, `revoke all … from anon`, `created_by default auth.uid()`, CHECKs de longitud y valores (estado, RRULE sin DTSTART, teléfono, horas coherentes, excepciones) y `on delete cascade` desde `ordenes`. **Probada**: en una base PostgreSQL 16 local (2 veces, con `anon` sin acceso y los CHECK rechazando datos malos) y en la base real dentro de una transacción deshecha (fase 1 + fase 2, cada una 2 veces): 12 políticas, RLS activa, `anon` sin acceso, 457 órdenes intactas; después solo existe `ordenes`. **NO aplicada.**
- **Conversión de `fecha_visita`**: `supabase/conversiones/20261119113500_fecha_visita.sql` (FUERA de `migrations`, para que no se aplique sola; usa una función temporal `pg_temp`, sin `security definer`). La misma lógica que `fechaVisita.ts`; con los datos reales (leídos en solo lectura y borrados después) dan **exactamente** el mismo resultado. **Simulación (19-11-2026)**: 142 órdenes → **148 visitas** (104 hechas, 44 fallidas, 0 pendientes); 135 encajan con `estado_visita` y 7 no (3 «SIN VISITA» con 1 fecha → hecha; 3 «1º FALLIDA, REALIZADA» con 1 fecha → hecha; 1 «REALIZADA» con 2 fechas → las dos hechas). **8 dudosas** sin convertir: 5 «FALLIDA» sin fecha, «14/04/2025 FALLIDA», «9/05/2026 29/06/2026» (día con una cifra) y «1º visita 19-11-24; 2º visita el 3-12-24». **Pendiente de su visto bueno.**
- **Datos**: `api.ts` con eventos (por rango, visitas futuras, por orden, por tipos), tareas (por rango + pendientes sin fecha o atrasadas) y tipos; versión real y demo. Columnas explícitas, filtros solo con fechas validadas, campos de escritura en lista blanca (`soloCampos`). Estado único `src/state/agenda.tsx` (lo que cambia en un sitio se ve en todos) y acciones `src/state/acciones.ts` + `components/agenda/Gestor.tsx`.
- **Pantallas**: calendario con Plazos, Hoy/Agenda, Día, Semana, Mes y Año; capas con color, icono, contador y botón (Hitos apagada al empezar); panel «Por programar» (arrastrar en el ordenador, botón «Programar» en todas partes); ficha rápida (Editar, Duplicar, Eliminar, Abrir la orden, Hecha/Fallida; en el móvil, hoja inferior con «Cómo llegar» y «Llamar»); formularios de cita (tipo, orden, todo el día/horas, dirección, teléfono, notas, avisos, repetición con «hasta», «solo este / toda la serie») y de tarea (orden, fecha, hora, duración, prioridad, repetición, «para la oficina»); pregunta «¿Actualizo la orden?» al marcar Hecha/Fallida (última actuación, 1.ª actuación si falta y estado de la visita; cada cambio se puede desmarcar). Ordenador: FullCalendar 7.1.5 (tema monarch con los tokens de la app, `src/fc-tema.css`), crear arrastrando, mover y estirar (si falla, vuelve a su sitio), soltar órdenes y tareas desde «Por programar», atajos P G D S M A T J K N / ?. Móvil: arranca en «Hoy», Mes compacto con puntos, Semana en lista, Año a mano, deslizar el dedo, botón «+» encima de la barra, objetivos ≥ 44 px. FullCalendar y el calendario entero se cargan con `import()` diferido (en el móvil FullCalendar no se descarga nunca; la carga inicial pasa de 129 a 105 KB comprimidos).
- **Tabla y orden**: columna «Próxima visita» con semáforo (antes del plazo / después / sin visita y con prisa), ordenable y ocultable; botón «Programar visita» en cada orden (tabla, lista del móvil); CSV con la próxima visita y la columna de texto original («Notas de visita (Excel)»). `OrdenForm`: «Agenda de esta orden» con plazos, visitas, tareas y botones; el minicalendario CREA la visita en el calendario (en una orden nueva, al guardarla); el texto queda como «Notas de visita (Excel)». Al borrar una orden, «Deshacer» también recupera sus visitas y tareas.
- **Navegador** (demo, Playwright): ordenador, 375 y 412 px, claro y oscuro, sin desplazamiento horizontal ni errores de JS. Probado mover, crear arrastrando, soltar desde «Por programar», atajos, deslizar y la pregunta de la orden. Build de producción con `vite preview` y las cabeceras de Vercel: **ninguna violación de la CSP** (no ha hecho falta ampliarla).

#### Decisiones de la fase 2 (por si hay que cambiarlas)
- «Pulsar cualquier cosa de una orden abre su formulario»: los plazos e hitos abren la orden directamente; las visitas/citas y tareas abren la ficha rápida, que tiene «Abrir la orden» (si no, no se podría marcar Hecha/Fallida de un toque).
- «Día libre» para visitas = domingo o lunes no festivo con menos de 4 visitas pendientes (`VISITAS_POR_DIA` en `semana.ts`).
- Tareas «para la oficina»: las sin fecha salen el próximo lunes; las que tienen fecha, el lunes de su semana. No salen en «Por programar».
- En una serie, marcar Hecha/Fallida o editar «solo este» crea una excepción; desde la ficha, «Eliminar» quita solo ese día (la serie entera, desde «Editar»).
- La «Próxima visita» y «Por programar» miran las visitas pendientes de hoy en adelante (las series de visitas no cuentan para la próxima visita).

#### Pendiente / a tener en cuenta (fase 2)
- ~~Aplicar las DOS migraciones~~ **Hecho el 19-11-2026** con su permiso: probadas otra vez en una transacción deshecha con su versión final y aplicadas juntas en una sola transacción; registradas en `supabase_migrations.schema_migrations` (`20261119085251`, `20261119112716`). Comprobado: 457 órdenes, 26 festivos, 2 tipos de cita, 24 políticas, `anon` sin acceso.
- Conversión de `fecha_visita` (decidido con la usuaria, 19-11-2026): si una orden tiene varias fechas se crean todas («1ª visita», «2ª visita»…); se aceptan días/meses de una cifra y fechas «dd-mm-aa»; «dd/mm/aaaa FALLIDA» marca esa visita como fallida; palabras como «1º visita el…» se permiten, y si el texto trae algo más que fechas se copia entero en los detalles de la visita («Texto del Excel: «…»»). La app y el SQL dan exactamente lo mismo con los datos reales (158 filas, misma huella md5). **Nueva simulación: 145 órdenes → 153 visitas (107 hechas, 46 fallidas); 8 no encajan con el estado y van por la regla general; solo 5 dudosas («FALLIDA» sin fecha, todas de órdenes finalizadas): no se convierten y el texto se queda como nota.** Pendiente: su «sí» final para ejecutarla.
- Al marcar una visita o cita como Hecha o Fallida sale siempre la ventana de resultado con «Detalles de la visita» (se guardan en `eventos.notas`) y, si es de una orden, la pregunta de actualizarla.
- `@fullcalendar/core` 7.1.5 aparece en `node_modules` porque lo trae `@fullcalendar/react` 7 (no lo hemos instalado nosotros y no es la v6).

### Fase 3: alertas y resumen semanal por correo
- Migraciones: `avisos_orden` (extra, silenciar, posponer), `avisos_enviados` y `preferencias`.
- Campana dentro de la app, notificaciones del navegador o del móvil (si las acepta) y correo opcional.
- Edge Function `resumen-semanal` + pg_cron (por defecto, el sábado por la tarde; se puede cambiar) y recordatorio opcional el domingo por la noche. Botón «Enviármelo ahora». Si la semana está vacía, no se manda nada.
- Prueba que compara los plazos de la Edge Function con los de la web.

### Fase 4: extras
- Enlace iCal privado con token que se puede regenerar.
- Alta en lenguaje normal («Visita Talleres Pérez domingo 10-11»).
- Plantillas de cita.
- Estadísticas: visitas hechas y fallidas por mes, y plazos cumplidos frente a vencidos.

## 3 bis. Después de la fase 2 (19-11-2026)
- **Conversión de `fecha_visita` EJECUTADA** (con su permiso): 153 visitas en 145 órdenes (107 hechas, 46 fallidas, 16 numeradas «1ª/2ª visita», 3 con el texto del Excel en los detalles). Las 5 «FALLIDA» sin fecha se quedan solo como texto. Para deshacerla: borrar los `eventos` con `origen = 'excel'`.
- **Estado «DEVUELTA»** (naranja intenso, distinto del naranja suave de «Pte. entrega»): cuenta como ACTIVA (sigue con plazos, avisos y «Por programar»), tarjeta propia en los totales. Migración `20261119123040_devuelta_historial.sql`.
- **Historial de cada orden** (en el formulario, desplegable): fechas de la orden, visitas y citas (con sus detalles), tareas y los cambios de datos, por orden cronológico, con «día N» desde la fecha de la orden y los días entre cada cosa. Los cambios los guarda la base de datos (tabla `historial_ordenes`, disparador `registrar_historial_orden`, único `security definer` justificado: así nadie puede falsear ni borrar el historial desde la app; la prueba de migraciones solo lo permite para esa función). Los cambios anteriores al despliegue no existen (no se registraban).
- Migración probada en la base real en una transacción deshecha (2 veces): el historial apunta el cambio, solo lectura para `authenticated`, nada para `anon`, la función no la puede llamar nadie. **Aplicada en producción y publicada el 19-11-2026 (con su permiso).**
- **Tutorial interactivo** (botón «?» arriba, en el móvil y en el ordenador): 14 pasos que señalan cada parte (totales, buscar, lista, programar visita, nueva orden, calendario, vistas, capas, Por programar, visitas, añadir, Ajustes). Esc para salir y flechas para avanzar. No toca datos. Las partes señaladas llevan `data-tour="…"` (`src/components/Tutorial.tsx`).
- **Seguridad del inicio de sesión (S1, S3, S4, S6, S7)**: la usuaria decide dejarla como está por ahora (20-11-2026).
- **Servidor MCP para ChatGPT**: prompt maestro en `docs/prompt-mcp-chatgpt.md` (incluye el aviso de privacidad: los datos saldrían hacia OpenAI). Hecho: ver 3 ter.

## 3 ter. Servidor MCP para ChatGPT (20-11-2026, rama `mcp-chatgpt`)
Guía completa (conectar, quitar el acceso, cómo está hecho): **`docs/mcp-chatgpt.md`**.

**Decisiones de la usuaria**
- Su organismo le permite usar ChatGPT con estos datos (confirmado el 20-11-2026). Plan de ChatGPT: **pendiente de que lo diga** (en Plus/Pro puede que solo funcionen las herramientas de leer).
- Arquitectura aprobada: función de Supabase + OAuth 2.1 de Supabase Auth con su usuario + las herramientas del encargo.
- «Aceptar el permiso una vez» (sin reconectar al actualizar) y «privado, solo con usuario de Supabase». La interfaz, con el mismo estilo que la web.

**Investigación (documentación actual, 20-11-2026)**
- ChatGPT: servidor MCP remoto por HTTPS («streamable HTTP»), autenticación OAuth (registro dinámico de clientes o CIMD), redirección a `chatgpt.com`. Las herramientas sin `readOnlyHint` cuentan como de escritura y ChatGPT pide confirmación. Business/Enterprise/Edu: leer y escribir; Plus/Pro: modo desarrollador, y la ayuda actual sugiere que en Pro solo lectura (contradictorio entre fuentes).
- Supabase: servidor OAuth 2.1 (beta, gratis), con registro dinámico, pantalla de permiso propia (`site_url` + `/oauth/consent`) y tokens JWT normales con `client_id` (RLS igual). Guía oficial «Deploy MCP servers» con `@modelcontextprotocol/server` 2.x y `@supabase/server` (`withOAuthProtectedResource` + `withSupabase`). El proyecto ya firma con ES256 (necesario). Sesiones sin caducidad (`sessions_timebox = 0`): por eso el permiso dura hasta que se quite.
- Alojamiento elegido: **función de Supabase** (misma plataforma que la BD, guía oficial, sin secretos nuevos) frente a Vercel (la web es Vite sin funciones; habría que montar todo a mano y añadir variables).

**Hecho**
- `src/mcp`: 17 herramientas (9 de lectura, 8 de escritura, **ninguna de borrar ni de SQL**), esquemas zod estrictos, «hoy» en hora de España, respuestas cortas y sin notas/direcciones/teléfonos salvo `incluir_detalles`, recorte a 15 000 caracteres, errores sin detalles internos, registros sin datos personales, límite de 60 peticiones/min y 600/hora, cuerpo ≤ 64 KB.
- Entrada (`src/mcp/http.ts` + `funcion.ts`): `withOAuthProtectedResource` → `withSupabase({ auth: 'user', issuer })` → `comprobarIdentidad` (exige `client_id` = token OAuth, no una sesión de la web; `getUser` en cada petición para que revocar corte al momento; lista opcional `MCP_CLIENTES_PERMITIDOS`). Nunca `service_role`.
- Capa de datos compartida: `src/data/supabaseDatos.ts` (fábrica con el cliente de quien llama; la web la usa vía `supabaseBackend.ts`), tipos en `src/data/backend.ts`. Nuevos: `obtenerEvento`, `obtenerTarea` y los de OAuth (detalles, decidir, listar y revocar conexiones). El servidor solo ve `DatosMcp` (sin borrar ni ajustes).
- Web: pantalla de permiso `/oauth/consent` (`Consentimiento.tsx`, mismo estilo que la de entrar; si ya se aceptó, vuelve sola a ChatGPT; solo deja volver a `chatgpt.com`), aviso en `Login`, sección **Ajustes → Asistentes conectados** (quitar acceso) y `rewrites` en `vercel.json`. CSP sin cambios.
- Migración `20261120090000_mcp_chatgpt.sql`: `historial_ordenes.origen` («app»/«chatgpt», lo pone el disparador según `client_id`) y 12 políticas *restrictive*: con token de asistente no se borra en `ordenes`/`eventos`/`tareas` ni se escribe en `festivos`/`reglas_plazo`/`tipos_cita`. **Probada en la BD real en una transacción deshecha (ejecutada 2 veces)**: asistente borra 0 tareas/órdenes, alta de festivo rechazada (42501), cambia 0 festivos/tipos, lee bien; la web cambia y borra como antes; historial `alta:chatgpt, cambio:chatgpt, cambio:app`; `anon` sin acceso; 457 órdenes antes y después; comprobado después que no quedó nada (25 políticas, sin columna nueva). **NO aplicada.**
- `supabase/config.toml`: `[auth.oauth_server]` activado con registro dinámico y `[functions.mcp] verify_jwt = false` (solo documenta; no se ha empujado).
- Pruebas: **178** (antes 119): `src/mcp/mcp.test.ts` (53, datos inventados): entradas, campos desconocidos, lectura sin escrituras, escritura solo en la lista blanca, privacidad, hora de España con el proceso en UTC, protocolo MCP real (lista, llamada, errores), acceso (sin `client_id`, revocado, lista), límite y recorte; `oauth.test.ts`; pruebas de la migración. Lint (0 errores), build y `npm audit` (0) en verde.
- Probado con el **MCP Inspector oficial** (2.16.0, modo CLI) contra el servidor con datos de demo y el proceso en UTC: 17 herramientas con sus anotaciones y el informe semanal correcto. Probado el paquete en **Deno** 2.9 (el motor de Supabase): sin token responde 401 con `WWW-Authenticate` y la metadata OAuth apunta a `…supabase.co/auth/v1`.
- Capturas (Playwright, demo): pantalla de permiso en ordenador y móvil (375/412), claro y oscuro, y Ajustes → Asistentes conectados: sin desplazamiento horizontal ni errores de JS.

**Activado (20-11-2026, con su permiso para los pasos 1-4)**
1. `main` = `4051aae` (se unió antes el commit nuevo de `main` «Selector de tema»; conflictos en `main.tsx` y `Ajustes.tsx` resueltos conservando las dos cosas; 178 pruebas, lint y build en verde; capturas repetidas).
2. Migración `20261120090000_mcp_chatgpt.sql` aplicada en una sola transacción y registrada en `supabase_migrations.schema_migrations`. Comprobado: 37 políticas (12 *restrictive*), columna `origen`, 457 órdenes.
3. Auth (Management API): `oauth_server_enabled = true`, `oauth_server_allow_dynamic_registration = true`, `oauth_server_authorization_path = /oauth/consent` (Site URL ya era `https://vicky-inspe.vercel.app`; registro de usuarios sigue cerrado).
4. Función `mcp` publicada (versión 1, ACTIVE, `verify_jwt = false`), el mismo paquete probado en Deno. Desde esta sesión no se puede llamar a `…supabase.co` (la red solo deja la Management API), así que la prueba en vivo queda para ella o para otra sesión con acceso.

**Pendiente**: su plan de ChatGPT es **Go**, que según la información disponible (20-11-2026) **no** permite conectar servidores MCP propios (el modo desarrollador empieza en Plus; escribir puede requerir Business). Opciones: subir a Plus (o superior) y conectarlo con `docs/mcp-chatgpt.md`, o dejarlo así (sin uso no hace nada) o desactivarlo (OAuth Server off). Después: probar con una orden de prueba y fijar `MCP_CLIENTES_PERMITIDOS`.

## 4. Seguridad: hallazgos de la auditoría (19-11-2026) y propuestas

| # | Hallazgo | Riesgo | Propuesta | Estado |
|---|---|---|---|---|
| S1 | Contraseña mínima de 6 caracteres, sin requisitos | Medio | Subir a 12+ con letras y números (Supabase → Auth → Providers → Email) | Pendiente de su visto bueno |
| S2 | Las políticas RLS dejan a CUALQUIER usuario con sesión (hoy solo hay 1 y el registro está cerrado) | Bajo hoy, alto si se abre el registro o se crea otro usuario | Lista de usuarios autorizados (`usuarios_autorizados`) y políticas `using (es_autorizado())` en todas las tablas | **No se aplica por ahora** (decisión de la usuaria, 19-11-2026): solo hay 1 usuario y no se pueden registrar más. Comprobado: 1 usuario en `auth.users`, `disable_signup = true`, anónimos desactivados. **Si algún día se crea otro usuario, aplicar S2 antes.** |
| S3 | MFA (TOTP) activo en Supabase pero la app no lo usa | Medio (móvil en la calle) | Segundo factor con app de códigos al iniciar sesión | Proponer en la fase 4 |
| S4 | La protección contra contraseñas filtradas está desactivada | Bajo | Activarla (puede requerir plan Pro) | Pendiente |
| S5 | La web no tenía cabeceras de seguridad | Medio | `vercel.json` | **Hecho en la fase 1** |
| S6 | El token de la Management API guardado en el entorno da control total del proyecto | Medio | Crearlo con caducidad y revocarlo al terminar el proyecto | Avisado |
| S7 | Sesión sin caducidad por inactividad | Bajo-medio | Caducidad por inactividad (si el plan lo permite) o bloqueo de la app con PIN | Proponer |

### Auditoría de la fase 2 (19-11-2026)
- **Base de datos**: las 3 tablas nuevas con RLS, 4 políticas `to authenticated` cada una, `revoke all … from anon` (comprobado: `anon` no puede ni leer), sin `security definer`, `created_by default auth.uid()`. CHECKs: longitudes de todos los textos, estados y prioridades cerrados, teléfono solo con cifras/espacios/«+», RRULE con formato fijo y sin DTSTART, horas coherentes, máximo de avisos y de días quitados. Claves foráneas: el tipo debe existir; borrar una orden borra sus citas y tareas (cascada). La migración no toca `ordenes` (prueba automática).
- **Conversión**: fuera de las migraciones automáticas; no modifica `ordenes`; repetible sin duplicar (`clave_origen` única); función temporal `pg_temp` (desaparece al acabar la sesión). Los datos reales usados para la simulación se leyeron en solo lectura y se borraron; no están en el repositorio ni en las pruebas.
- **App**: todo lo que llega de la base de datos pasa por `leerEvento` / `leerTarea` / `leerTipo` (fila rara = descartada); lo que llega de la URL por `leerRuta` (vista de una lista cerrada, fecha válida entre 1990 y 2100, orden con formato UUID); lo que llega de un elemento arrastrado se valida (UUID y orden existente). Solo se escriben los campos de una lista blanca. Ni `dangerouslySetInnerHTML` ni `eval` (comprobado con búsqueda). «Cómo llegar» y «Llamar»: datos codificados con `encodeURIComponent`, solo `https:` y `tel:` (comprobado con `esquemaPermitido`), `rel="noopener noreferrer"`. Los iconos de los tipos de cita salen de una lista cerrada.
- **CSP**: sin cambios; FullCalendar 7 funciona con la CSP actual (probado con el build y `vite preview`, cero violaciones).
- **Dependencias**: `@fullcalendar/react` 7.1.5 (MIT), `rrule` 2.8.1 (BSD), `temporal-polyfill` 1.0.8 (MIT). `npm audit`: 0 vulnerabilidades.
- **Sin cambios** en S1–S7: siguen pendientes de su visto bueno.

### Auditoría del servidor MCP (20-11-2026)
- **Acceso**: solo OAuth 2.1 de Supabase Auth con el usuario de la app; sin «modo abierto» ni enlaces secretos. Token comprobado (firma ES256 con JWKS, caducidad, emisor = este proyecto) y además: `role = authenticated`, `client_id` presente (una sesión de la web copiada no sirve) y sesión viva (`getUser`, así revocar corta al momento). Nunca `service_role` (el contexto lo ofrece, el código no lo usa: búsqueda hecha). RLS se aplica igual.
- **Pantalla de permiso**: solo vuelve a `https://chatgpt.com` / `chat.openai.com` (prueba con dominios parecidos, `javascript:`, usuario:clave@…); otro programa se deniega sin redirigir. `authorization_id` validado.
- **Herramientas**: sin borrar, sin SQL libre, sin tocar ajustes (también lo impide la BD con políticas *restrictive*). Esquemas estrictos; `editar_orden` con lista blanca; series y visitas ya marcadas no se mueven; `actualizar_orden` solo si ella lo dice.
- **Datos que salen a OpenAI**: lo mínimo por defecto; textos libres, direcciones y teléfonos solo con `incluir_detalles` (el historial los oculta como «(oculto)»).
- **Secretos**: ninguno nuevo; nada en el repositorio. El paquete `index.js` se genera y no se sube.
- **Dependencias** nuevas (fijadas): `@modelcontextprotocol/server` 2.4.0, `@supabase/server` 1.9.2, `@supabase/middleware` 1.0.0, `zod` 4.6.7 y `esbuild` 0.28.2 (desarrollo). `npm audit`: 0. La web no las incluye (comprobado en el build).

| # | Riesgo que queda | Nivel | Qué hacer |
|---|---|---|---|
| M1 | Lo consultado sale hacia OpenAI | Aceptado (organismo de acuerdo) | Pedir lo mínimo; activar «no usar para entrenar» si la cuenta lo permite |
| M2 | Registro dinámico abierto (también en producción): cualquiera puede crear un conector de ChatGPT apuntando aquí. Su dirección de vuelta también es `chatgpt.com`, así que la comprobación de dominio **no** lo distingue del bueno; si ella pulsa «Permitir» (p. ej. por un enlace engañoso), ese token funciona **también contra la API REST directa**, saltándose el servidor MCP y `MCP_CLIENTES_PERMITIDOS` | **Medio** (revisado en la auditoría del 23-11-2026; antes se valoró «Bajo») | Hecho en código: la pantalla de permiso compara el `client_id` con `VITE_OAUTH_CLIENTES` (vacía = rechaza todo). Pendiente: desactivar el registro dinámico (o el OAuth Server mientras no se use), fijar `VITE_OAUTH_CLIENTES` y `MCP_CLIENTES_PERMITIDOS`, y aplicar la política *restrictive* por `client_id` (`docs/propuestas-bd/medios-4-15.sql`, bloque #5; pasos en `docs/propuestas-bd/ajustes-panel.md`) |
| M3 | Si alguien entra en su cuenta de ChatGPT, podría usar la conexión (no caduca) | Medio | Doble factor en ChatGPT; quitar el acceso en Ajustes si pierde un dispositivo |
| M4 | Instrucciones escondidas en textos de las órdenes (prompt injection) | Bajo | Escrituras con confirmación, sin borrar; las notas no salen por defecto |
| M5 | Límite de peticiones por instancia (en memoria), no global | Bajo | Suficiente para 1 usuaria; Supabase limita además los tokens |
| M6 | OAuth Server de Supabase en beta | Bajo | Revisar avisos de Supabase |
| M7 | En Plus/Pro, ChatGPT puede permitir solo herramientas de leer | — | Confirmar su plan |
| S2 | RLS deja a cualquier usuario con sesión | Bajo hoy (1 usuario) | Sigue igual: si se crea otro usuario, aplicar S2 antes |
| S8 | (Encontrado de paso, ya existía) `set_fecha_cierre` usa `current_date` (UTC): entre las 00:00 y las 01:00/02:00 de España la fecha de cierre saldría del día anterior si la web no la manda | Bajo | El servidor MCP manda la fecha de España; revisar la web en otra sesión |

## 5. Cómo cierro cada fase
`npm run lint`, pruebas y `npm run build` en verde. Capturas con Playwright en el ordenador, a 375 px y a 412 px, en claro y en oscuro, comprobando que no haya desplazamiento horizontal. Actualizo este documento y el README, te lo resumo y **te pregunto antes de subirlo a `main`**.

## 6. Registro
- 19-11-2026: Paso 0. Código revisado, plan escrito y preguntas enviadas.
- 19-11-2026: respuestas 1–4 recibidas a través de otra sesión e incorporadas (2 bis). Pendiente: confirmación, correo y proyecto de Supabase.
- 19-11-2026: la usuaria da el correo y el proyecto. Acceso a Supabase comprobado. Pendiente: visto bueno para la fase 1.
- 19-11-2026: visto bueno. **Fase 1 terminada** (rama `calendario`). Auditoría de seguridad (apartado 4). Se lanza la fase 2 en otra sesión.
- 19-11-2026: migraciones de las fases 1 y 2 aplicadas en producción (con permiso). S2 descartada por ahora (1 solo usuario, registro cerrado). Conversión ajustada con sus indicaciones (1ª/2ª visita, detalles) y ventana de resultado con detalles. Fases 1 y 2 subidas a `main` (commit f129923) y desplegadas en Vercel: READY en `vicky-inspe.vercel.app`.
- 19-11-2026: **Fase 2 terminada** (rama `calendario-fase2`). Migración probada (no aplicada), simulación de la conversión hecha (pendiente de visto bueno), auditoría de la fase 2 (apartado 4). Encargo de la fase 3 en `docs/prompt-fase3.md`.
- 20-11-2026: **Servidor MCP para ChatGPT** (rama `mcp-chatgpt`): aviso de privacidad (su organismo lo permite), investigación y arquitectura aprobadas, programado, probado (178 pruebas, Inspector, Deno, migración en transacción deshecha) y auditado. Con su permiso, el mismo día: subido a `main`, migración aplicada, OAuth Server activado y función `mcp` publicada. Su plan de ChatGPT (Go) no admite servidores propios: pendiente de que decida.
