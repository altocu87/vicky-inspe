# Plan: calendario integrado con las órdenes

> Documento vivo: sirve de memoria entre sesiones. Se actualiza al cerrar cada fase.
> Estado: **Paso 0. Plan escrito, pendiente del visto bueno y de las respuestas (apartado 2).**

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

## 3. Fases

### Fase 1: reglas de plazo, vista Plazos y unión básica con la tabla
- Vitest, más pruebas de `edate`, días hábiles y fin «de todo el día».
- `fechas.ts`, `habiles.ts`, reglas y motor. Las dos reglas de hoy pasan al nuevo formato, con pruebas que comparan fecha a fecha con `plazo9Meses`/`plazoSiguiente`, incluidos los finales de mes (31 → 28/29, bisiestos).
- Migración: tablas `festivos` y `reglas_plazo` (configuración: activa y días de aviso por regla). Las reglas base viven en el código; la tabla solo guarda ajustes.
- `api.ts` y estado compartido de filtros.
- Pantalla `#calendario` (mismo mecanismo que `#estadisticas`) con la **vista Plazos** hecha a mano: grupos Vencidos / Esta semana / La siguiente / Este mes / Después; filtros por tipo y nivel; marca de fin de semana o festivo; al pulsar, se abre la orden. En el móvil, tarjetas grandes.
- Tabla, tarjetas y `ListaMovil`: columna «Próximo plazo» (que se puede ordenar y ocultar) e icono «Ver en el calendario» (`#calendario?orden=id`). El CSV añade el próximo plazo.
- `OrdenForm`: apartado «Agenda de esta orden» (de momento, solo sus plazos).

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

## 4. Cómo cierro cada fase
`npm run lint`, pruebas y `npm run build` en verde. Capturas con Playwright en el ordenador, a 375 px y a 412 px, en claro y en oscuro, comprobando que no haya desplazamiento horizontal. Actualizo este documento y el README, te lo resumo y **te pregunto antes de subirlo a `main`**.

## 5. Registro
- 19-11-2026: Paso 0. Código revisado, plan escrito y preguntas enviadas.
