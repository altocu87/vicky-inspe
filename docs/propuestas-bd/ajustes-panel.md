# Ajustes que hay que hacer a mano en el panel de Supabase (puntos 4-15 de la auditoría)

Estos cambios **no** se pueden hacer desde el código: se hacen en <https://supabase.com/dashboard>,
entrando en el proyecto de la app. No borran datos. El fichero `supabase/config.toml` del repositorio
ya lleva los mismos valores, pero ese fichero **solo** sirve para pruebas locales: el proyecto real
no lo lee.

## #5 · Conexión con ChatGPT (OAuth)

1. **Authentication → OAuth Server** (puede aparecer como «OAuth Apps»):
   - Si **no** usas ChatGPT con la app ahora mismo: **desactiva el OAuth Server**. Es lo más seguro.
   - Si lo usas: **desactiva «Allow dynamic client registration»** (registro dinámico) *después* de
     haber conectado ChatGPT. Así nadie más puede dar de alta un conector nuevo apuntando a tu app.
     (Si algún día hay que volver a conectar ChatGPT desde cero, actívalo un momento y vuelve a
     desactivarlo al terminar.)
2. Apunta el **id del cliente** de ChatGPT (aparece en la lista de OAuth Apps y en el mensaje
   «No se ha conectado» de la app al intentar conectar).
3. En **Vercel → proyecto → Settings → Environment Variables**, crea `VITE_OAUTH_CLIENTES` con ese id
   (si hubiera varios, separados por comas) y vuelve a desplegar. Sin esta variable la pantalla de
   permiso rechaza cualquier conexión nueva.
4. En **Supabase → Edge Functions → mcp → Secrets**, pon el mismo id en `MCP_CLIENTES_PERMITIDOS`.
5. Aplica el bloque «#5» de `docs/propuestas-bd/medios-4-15.sql` cambiando `<CLIENT_ID_CHATGPT>` por
   ese id (protege también la API directa, no solo el servidor MCP).
