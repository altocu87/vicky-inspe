# Inspecciones

Portal web para el seguimiento de órdenes, visitas y plazos de una subinspectora. Sustituye a la hoja Excel «VICKY INSPE».

- **Frontend:** React + Vite + TypeScript, estilo Material 3 Expressive
- **Datos y acceso:** Supabase (tabla `ordenes`, solo usuarios con sesión iniciada)
- **Publicación:** Vercel

## Plazos calculados (igual que en el Excel)

| Campo | Cálculo |
|---|---|
| Límite 9 meses | Primera actuación + 9 meses |
| Siguiente actuación | Última actuación + 5 meses, sin pasar del límite de 9 meses |
| Aviso | Más de 90 días · De 31 a 90 · 30 o menos · Vencido |

Las fechas límite salen de **reglas de plazo** (`src/lib/plazos/reglas.ts`), que calcula un único motor (`src/lib/plazos/motor.ts`). Se pueden añadir reglas nuevas en **Ajustes** (días naturales, días hábiles o meses, con tope opcional) sin tocar las pantallas. Si un plazo cae en sábado, domingo o festivo, se marca (la fecha no cambia).

## Calendario

- **#calendario**: vistas **Plazos** (fechas límite agrupadas), **Hoy/Agenda**, **Día**, **Semana**, **Mes** y **Año** (`#calendario?vista=mes&fecha=2026-11-19`). Usa los mismos filtros que la tabla (estado, «urgentes», «sin tiempo», búsqueda).
- **Visitas, citas y tareas** (tablas `eventos`, `tareas` y `tipos_cita`): capas de colores (Plazos, Visitas y citas, Tareas, Hitos de la orden y Festivos), panel **Por programar**, ficha rápida con «Cómo llegar», «Llamar», «Hecha» y «Fallida» (y la pregunta de si se actualiza la orden), repeticiones y tareas «para la oficina». La semana está hecha a su medida: el lunes es de oficina y el domingo y el lunes de visitas.
- En el ordenador (FullCalendar 7): crear arrastrando, mover y estirar, y atajos de teclado (`?` para verlos). En el móvil: arranca en «Hoy», mes compacto con puntos, semana en lista, deslizar el dedo y botón «+».
- Tabla: columna **Próxima visita** (con semáforo) y botón **Programar visita**; el CSV la incluye.
- La conversión del texto heredado `fecha_visita` está en `supabase/conversiones/` y **solo se ejecuta a mano y con permiso**.
- Desde cada orden (tabla, tarjetas o lista del móvil), el icono **Ver en el calendario** abre `#calendario?orden=<id>`.
- **#ajustes**: festivos de Albacete (nacionales, de Castilla-La Mancha y locales), tipos de cita, reglas de plazo y **Asistentes conectados** (quitar el acceso a ChatGPT).
- Plan completo y estado de cada fase: [`docs/plan-calendario.md`](docs/plan-calendario.md).

## ChatGPT (servidor MCP)

Desde ChatGPT se puede consultar y apuntar cosas hablando normal («¿qué vence esta semana?», «apunta visita el domingo a la orden…»). Entra con el usuario de la app (OAuth de Supabase Auth; el permiso se da una vez en `/oauth/consent`), respeta RLS y **no puede borrar nada**. Código en `src/mcp` (función de Supabase `mcp`, se empaqueta con `npm run build:mcp`). Guía para conectarlo y para quitar el acceso: [`docs/mcp-chatgpt.md`](docs/mcp-chatgpt.md). ⚠️ Lo que se consulta desde ChatGPT sale hacia OpenAI.

## Desarrollo local

```bash
cp .env.example .env.local   # rellena la URL y la clave publicable de Supabase
npm install
npm run dev
```

## Pruebas

```bash
npm test          # pruebas automáticas (Vitest), con la hora de España
npm run lint
npm run build
```

Para probar las pantallas sin datos reales: `VITE_DEMO=1 npm run dev` (datos inventados en memoria; **solo** funciona en desarrollo, nunca en la web publicada).

## Seguridad

- Supabase: todas las tablas con RLS; solo usuarios con sesión; nada para `anon`. Registro público desactivado.
- ⚠️ **Antes de dar de alta a otra persona** (aunque sea una cuenta de prueba): hoy las políticas dejan ver y cambiar todo a *cualquier* usuario con sesión (`using (true)`). Es seguro solo porque hay una única cuenta. Antes de crear otra, aplicar la lista de usuarios autorizados de [`docs/propuestas-bd/bajos-16-30.sql`](docs/propuestas-bd/bajos-16-30.sql) (punto 29).
- Toda lectura/escritura pasa por `src/data/api.ts` (web) y `src/data/supabaseDatos.ts` (la misma capa, también para el servidor MCP); lo que llega de la base de datos o de la URL se valida antes de usarse.
- Vercel (`vercel.json`): cabeceras de seguridad (CSP estricta, sin marcos, HSTS, `no-referrer`…). `npm run preview` aplica las mismas (`seguridad.headers.json`); una prueba comprueba que coinciden.
- El CSV exportado neutraliza fórmulas (evita la «inyección CSV» al abrirlo en Excel).
- Servidor MCP para ChatGPT: solo con OAuth y el usuario de la app (nunca `service_role`), sin herramientas de borrar ni SQL libre, entradas validadas, límite de peticiones y registros sin datos personales. La base de datos impide que un token de asistente borre o toque los ajustes. Al quitar el acceso en Ajustes, el servidor MCP lo corta al momento, pero el token que ya tenía el asistente puede seguir valiendo contra la base de datos **hasta 15 minutos** (`jwt_expiry = 900`; poner el mismo valor en el panel de Supabase). Auditoría en `docs/plan-calendario.md` (apartado 4).

## Base de datos

Las migraciones están en `supabase/migrations` (se pueden ejecutar dos veces sin romper nada y nunca borran datos). La conversión única de `fecha_visita` está aparte, en `supabase/conversiones/`. Para aplicar las migraciones:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Usuarios

El registro público está desactivado. Los usuarios se crean en Supabase → Authentication → Users → Add user.
