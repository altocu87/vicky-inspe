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

- **#calendario**: vista **Plazos**, con todas las fechas límite agrupadas (vencidos, esta semana, la siguiente, este mes y después) y filtros por nivel y tipo de plazo. Usa los mismos filtros que la tabla (estado, «urgentes», «sin tiempo», búsqueda).
- Desde cada orden (tabla, tarjetas o lista del móvil), el icono **Ver en el calendario** abre `#calendario?orden=<id>`.
- **#ajustes**: festivos de Albacete (nacionales, de Castilla-La Mancha y locales) y reglas de plazo.
- Plan completo y estado de cada fase: [`docs/plan-calendario.md`](docs/plan-calendario.md).

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
- Toda lectura/escritura pasa por `src/data/api.ts`; lo que llega de la base de datos o de la URL se valida antes de usarse.
- Vercel (`vercel.json`): cabeceras de seguridad (CSP estricta, sin marcos, HSTS, `no-referrer`…). `npm run preview` aplica las mismas (`seguridad.headers.json`); una prueba comprueba que coinciden.
- El CSV exportado neutraliza fórmulas (evita la «inyección CSV» al abrirlo en Excel).

## Base de datos

Las migraciones están en `supabase/migrations`. Para aplicarlas:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Usuarios

El registro público está desactivado. Los usuarios se crean en Supabase → Authentication → Users → Add user.
