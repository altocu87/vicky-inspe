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

## #6 · Proteger la cuenta (contraseña)

La app no tiene pantalla para cambiar la contraseña (se hace desde el correo de «recuperar contraseña»
o desde el panel), así que todo se ajusta en Supabase:

1. **Authentication → Providers → Email** (o **Authentication → Sign In / Providers → Email**):
   - **Minimum password length**: `12`.
   - **Password requirements**: «Letters and digits» (letras y números) como mínimo.
   - **Secure password change**: activado (para cambiar la contraseña hay que haber entrado hace poco
     o confirmar con un código).
   - **Secure email change**: activado (el cambio de correo se confirma en el correo viejo y en el nuevo).
2. **Authentication → Attack Protection** (o «Policies / Security»):
   - **Leaked password protection** (comprobar contraseñas filtradas, HaveIBeenPwned): activado.
     *Puede necesitar un plan de pago (Pro); si no aparece o está bloqueado, no pasa nada.*
3. **Cambia tu contraseña** si la actual tiene menos de 12 caracteres o no mezcla letras y números:
   la regla nueva solo se aplica al poner una contraseña nueva; la vieja sigue valiendo hasta entonces.
   Usa una frase larga o un gestor de contraseñas.
4. *(Opcional, más adelante)* **Doble factor (MFA, app de códigos)**: Authentication → Multi-Factor.
   La app todavía no tiene la pantalla para pedir el código, así que **no lo actives** hasta que se
   programe; queda anotado como mejora.
