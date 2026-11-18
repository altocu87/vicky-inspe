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
| Aviso | Más de 90 días · Entre 30 y 90 · Menos de 30 · Vencido |

## Desarrollo local

```bash
cp .env.example .env.local   # rellena la URL y la clave publicable de Supabase
npm install
npm run dev
```

## Base de datos

Las migraciones están en `supabase/migrations`. Para aplicarlas:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Usuarios

El registro público está desactivado. Los usuarios se crean en Supabase → Authentication → Users → Add user.
