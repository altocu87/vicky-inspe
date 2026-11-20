# Respaldo automático en Google Sheets

Todo lo que se apunta en la web (órdenes, visitas y citas, tareas, historial, tipos de cita, festivos y reglas de plazo) se copia solo a una hoja de Google Sheets en tu Drive, **cada cosa en su pestaña**.

- **Es solo una copia.** Lo que cambies en la hoja no cambia la web. La copia de cada noche vuelve a dejar la hoja igual que la web.
- **Al momento:** cada alta, cambio o borrado llega a la hoja en unos segundos.
- **Cada noche** (03:00 UTC, de madrugada en España) se manda todo entero, por si algún aviso se perdió.
- **Lo borrado no desaparece de la hoja:** se marca con la fecha en la columna **BORRADA EL**.
- **Cada lunes** se guarda una copia del archivo entero en la carpeta **«Copias respaldo Inspecciones»** de tu Drive. Se conservan las 12 últimas, unos 3 meses.
- Para tenerla en Excel: **Archivo › Descargar › Microsoft Excel (.xlsx)**.

## Piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Buzón de la hoja | `google-sheets/respaldo.gs` (se pega en Apps Script) | Recibe los avisos, comprueba la contraseña y escribe en la pestaña que toca |
| Avisos desde Supabase | `supabase/migrations/20261120125111_respaldo_google_sheets.sql` | Un disparador por tabla que manda cada cambio, y la copia completa de cada noche (`pg_net` y `pg_cron`) |
| Dirección y contraseña | Supabase Vault (cifrado) | Hasta que se configuran, no se envía nada |

Si Google falla o tarda, **la web no se entera ni se bloquea**: el envío se hace después de guardar y en segundo plano.

## Puesta en marcha (una sola vez, unos 5 minutos)

1. **Crea la hoja.** En Google Drive: **Nuevo › Hojas de cálculo de Google**. Ponle de nombre, por ejemplo, «Respaldo Inspecciones».
2. **Pega el programa.** En la hoja: **Extensiones › Apps Script**. Borra lo que hay en `Código.gs`, pega todo el contenido de `google-sheets/respaldo.gs` y pulsa 💾 **Guardar**.
3. **Prepara la hoja.** Vuelve a la hoja y recárgala (F5). Aparece el menú **Respaldo**. Pulsa **Respaldo › 1. Preparar la hoja** y acepta los permisos de Google. Saldrá el aviso «Google no ha verificado esta aplicación»: pulsa **Configuración avanzada › Ir a … (no seguro)**. Es normal, porque el programa es tuyo.
4. **Publica el buzón.** En Apps Script: **Implementar › Nueva implementación**. En la rueda ⚙️ elige **Aplicación web** y rellena:
   - *Ejecutar como:* **Yo**.
   - *Quién tiene acceso:* **Cualquier usuario**. Hace falta para que Supabase pueda entrar. Solo se acepta lo que lleve la contraseña.

   Pulsa **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).
5. **Conecta con la web.** En la hoja: **Respaldo › 2. Conectar con la web**. Pega la URL y te saldrá una línea parecida a esta:
   ```sql
   select respaldo.configurar('https://script.google.com/macros/s/…/exec', '…contraseña…');
   ```
   Pulsa **Copiar**. **No la compartas**, porque lleva la contraseña del buzón.
6. **Pégala en Supabase.** Ve a [supabase.com](https://supabase.com), abre el proyecto **vicky-inspe** y entra en **SQL Editor**. Pega la línea y pulsa **Run**. Debe responder «Respaldo configurado. Enviadas 7 tablas a la hoja.». En unos segundos se llenan las pestañas.

> La migración `20261120125111_respaldo_google_sheets.sql` ya está aplicada en Supabase (20-11-2026).

## Comprobar que funciona

- La pestaña **Info respaldo** muestra, por tabla, la hora de la última copia completa y del último cambio recibido.
- Si una pestaña no se actualiza, en Supabase › SQL Editor puedes ver las últimas respuestas de Google:
  ```sql
  select created, status_code, left(content, 200) from net._http_response order by created desc limit 20;
  ```
  Una respuesta `302` es normal (Google redirige después de recibirlo). `{"ok":false,"error":"no autorizado"}` significa que la contraseña no coincide: repite los pasos 5 y 6.
- Para mandar todo entero sin esperar a la noche: `select respaldo.enviar_todo();`

## Cambiar o quitar

- **Si cambias el programa de la hoja:** en Apps Script, **Implementar › Gestionar implementaciones › ✏️ › Versión: Nueva versión › Implementar**. Así la URL no cambia.
- **Nueva contraseña:** **Respaldo › Cambiar la contraseña del buzón** y repite el paso 6.
- **Parar el respaldo:** en Supabase › SQL Editor, `select respaldo.desconectar();`. Para volver a activarlo, repite los pasos 5 y 6.

## Límites conocidos

- Si se cambian cientos de filas de golpe (por ejemplo, una importación), Google puede rechazar algunos avisos por ir demasiado rápidos. La copia de la noche lo deja todo bien.
- Las columnas nuevas que se añadan a la base de datos aparecen solas en la hoja, antes de **BORRADA EL**.
