/**
 * Respaldo de «Inspecciones» en Google Sheets (SOLO COPIA).
 *
 * Este programa vive DENTRO de la hoja de cálculo (Extensiones › Apps Script) y hace de «buzón»:
 * Supabase le manda cada fila que se crea, cambia o borra en la web, y cada noche una copia completa.
 * La hoja nunca escribe en la web: si se toca algo aquí, la web no cambia (y la copia de la noche
 * lo vuelve a dejar como en la web).
 *
 * Partes importantes:
 *  - PESTANAS: qué tabla va a qué pestaña.
 *  - doPost: recibe los avisos. Solo acepta los que traen la contraseña correcta.
 *  - aplicarCambio / aplicarCompleto: escriben en la pestaña. Lo borrado NO se quita: se marca en
 *    la columna «BORRADA EL», para que el respaldo no pierda nada.
 *  - Menú «Respaldo»: preparar las pestañas y sacar la línea que hay que pegar en Supabase.
 *  - copiaSemanal: cada lunes guarda una copia del archivo entero en la carpeta «Copias respaldo
 *    Inspecciones» de tu Drive (se quedan las 12 últimas).
 *
 * Guía paso a paso: docs/respaldo-google-sheets.md
 */

var PESTANAS = {
  ordenes: 'Órdenes',
  eventos: 'Visitas y citas',
  tareas: 'Tareas',
  historial_ordenes: 'Historial',
  tipos_cita: 'Tipos de cita',
  festivos: 'Festivos',
  reglas_plazo: 'Reglas de plazo'
};

// Columnas que añade el respaldo al final de cada pestaña.
var COL_BORRADA = 'BORRADA EL';
var COL_SINCRO = 'ÚLTIMO AVISO';
var PESTANA_INFO = 'Info respaldo';
var CARPETA_COPIAS = 'Copias respaldo Inspecciones';
var COPIAS_A_GUARDAR = 12;

/* ------------------------------------------------------------------ */
/* Buzón: lo que manda Supabase                                        */
/* ------------------------------------------------------------------ */

function doPost(e) {
  var datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder({ ok: false, error: 'formato' });
  }

  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token || !datos || datos.token !== token) {
    return responder({ ok: false, error: 'no autorizado' });
  }
  if (!PESTANAS.hasOwnProperty(datos.tabla)) {
    return responder({ ok: false, error: 'tabla desconocida' });
  }

  // Un aviso cada vez, para que dos cambios a la vez no se pisen.
  var candado = LockService.getScriptLock();
  candado.waitLock(30000);
  try {
    var libro = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('LIBRO'));
    if (datos.tipo === 'cambio') {
      aplicarCambio(libro, datos);
    } else if (datos.tipo === 'completo') {
      aplicarCompleto(libro, datos);
    } else {
      return responder({ ok: false, error: 'tipo desconocido' });
    }
    anotarInfo(libro, datos);
    return responder({ ok: true });
  } finally {
    candado.releaseLock();
  }
}

function doGet() {
  return responder({ ok: true, mensaje: 'Buzón del respaldo de Inspecciones. Solo acepta avisos de Supabase.' });
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* Escritura en las pestañas                                           */
/* ------------------------------------------------------------------ */

// Una fila creada, cambiada o borrada.
function aplicarCambio(libro, datos) {
  var hoja = obtenerPestana(libro, datos.tabla);
  var cab = asegurarCabecera(hoja, datos.columnas || Object.keys(datos.fila || {}));
  var claves = leerClaves(hoja);
  var filaHoja = claves[String(datos.clave)];
  var colSincro = cab.indexOf(COL_SINCRO);
  var colBorrada = cab.indexOf(COL_BORRADA);

  // Si ya hay algo más reciente para esta fila, este aviso llegó tarde: se ignora.
  if (filaHoja) {
    var anterior = hoja.getRange(filaHoja, colSincro + 1).getValue();
    if (anterior instanceof Date && new Date(datos.momento) < anterior) return;
  }

  if (datos.operacion === 'DELETE') {
    if (!filaHoja) return;
    hoja.getRange(filaHoja, colBorrada + 1).setValue(new Date(datos.momento));
    hoja.getRange(filaHoja, colSincro + 1).setValue(new Date(datos.momento));
    return;
  }

  var valores = filaAValores(cab, datos.fila, null, new Date(datos.momento));
  if (filaHoja) {
    hoja.getRange(filaHoja, 1, 1, valores.length).setValues([valores]);
  } else {
    hoja.appendRow(valores);
  }
}

// La tabla entera (copia de la noche o la primera vez).
function aplicarCompleto(libro, datos) {
  var hoja = obtenerPestana(libro, datos.tabla);
  var cab = asegurarCabecera(hoja, datos.columnas || []);
  var momento = new Date(datos.momento);
  var colBorrada = cab.indexOf(COL_BORRADA);
  var colSincro = cab.indexOf(COL_SINCRO);

  // Lo que ya hay en la hoja, por clave.
  var ultima = hoja.getLastRow();
  var actuales = ultima > 1 ? hoja.getRange(2, 1, ultima - 1, cab.length).getValues() : [];
  var porClave = {};
  actuales.forEach(function (fila, i) { porClave[claveDe(fila[0])] = i; });

  var vistas = {};
  (datos.filas || []).forEach(function (fila) { vistas[String(fila[datos.clave])] = true; });

  // Lo que está en la hoja pero ya no en la web: se marca como borrado (no se quita).
  actuales.forEach(function (fila) {
    if (!vistas[claveDe(fila[0])] && !fila[colBorrada]) {
      fila[colBorrada] = momento;
      fila[colSincro] = momento;
    }
  });

  // Lo que está en la web: se actualiza su fila o se añade al final.
  var nuevas = [];
  (datos.filas || []).forEach(function (fila) {
    var clave = String(fila[datos.clave]);
    var valores = filaAValores(cab, fila, null, momento);
    if (porClave.hasOwnProperty(clave)) {
      actuales[porClave[clave]] = valores;
    } else {
      nuevas.push(valores);
    }
  });

  var todas = actuales.concat(nuevas);
  if (todas.length) {
    hoja.getRange(2, 1, todas.length, cab.length).setValues(todas);
  }
}

// Convierte una fila de la base de datos en los valores de la hoja, en el orden de la cabecera.
function filaAValores(cab, fila, borrada, momento) {
  var porTitulo = {};
  Object.keys(fila || {}).forEach(function (col) { porTitulo[titulo(col)] = fila[col]; });
  return cab.map(function (t) {
    if (t === COL_BORRADA) return borrada || '';
    if (t === COL_SINCRO) return momento;
    return convertirValor(porTitulo.hasOwnProperty(t) ? porTitulo[t] : null);
  });
}

function convertirValor(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'SÍ' : 'NO';
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.length ? "'" + v.join(', ') : '';
  if (typeof v === 'object') return "'" + JSON.stringify(v);
  var s = String(v);
  var dia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (dia) return new Date(Number(dia[1]), Number(dia[2]) - 1, Number(dia[3]));
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !isNaN(new Date(s).getTime())) return new Date(s);
  // Todo lo demás, como texto tal cual (el apóstrofo no se ve; evita que la hoja lo convierta
  // en número o en fórmula, p. ej. «0123» o «=…»).
  return s === '' ? '' : "'" + s;
}

/* ------------------------------------------------------------------ */
/* Pestañas y cabeceras                                                */
/* ------------------------------------------------------------------ */

// «fecha_primera_actuacion» → «FECHA PRIMERA ACTUACION»
function titulo(col) {
  return String(col).replace(/_/g, ' ').toUpperCase();
}

function obtenerPestana(libro, tabla) {
  var nombre = PESTANAS[tabla];
  var hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.insertSheet(nombre);
    hoja.setFrozenRows(1);
  }
  return hoja;
}

// Deja en la fila 1 todas las columnas (las que ya había, más las nuevas, más las del respaldo).
function asegurarCabecera(hoja, columnas) {
  var ancho = Math.max(hoja.getLastColumn(), 1);
  var actual = hoja.getRange(1, 1, 1, ancho).getValues()[0].filter(function (x) { return x !== ''; });
  var cab = actual.filter(function (t) { return t !== COL_BORRADA && t !== COL_SINCRO; });
  columnas.map(titulo).forEach(function (t) { if (cab.indexOf(t) < 0) cab.push(t); });
  cab.push(COL_BORRADA, COL_SINCRO);

  if (cab.join('|') !== actual.join('|')) {
    if (actual.length && (actual.indexOf(COL_BORRADA) >= 0)) {
      // Columnas nuevas en la base de datos: hay que mover las del respaldo al final.
      var n = hoja.getLastRow();
      var viejos = n > 1 ? hoja.getRange(2, 1, n - 1, actual.length).getValues() : [];
      var reordenados = viejos.map(function (fila) {
        return cab.map(function (t) { var i = actual.indexOf(t); return i >= 0 ? fila[i] : ''; });
      });
      hoja.clearContents();
      if (reordenados.length) hoja.getRange(2, 1, reordenados.length, cab.length).setValues(reordenados);
    }
    hoja.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#e8eaf6');
    hoja.setFrozenRows(1);
  }
  return cab;
}

// Clave (columna A) → número de fila en la hoja.
function leerClaves(hoja) {
  var n = hoja.getLastRow();
  var mapa = {};
  if (n < 2) return mapa;
  hoja.getRange(2, 1, n - 1, 1).getValues().forEach(function (f, i) { mapa[claveDe(f[0])] = i + 2; });
  return mapa;
}

// La clave tal como la manda Supabase (las fechas de «Festivos» vuelven a «2026-12-25»).
function claveDe(v) {
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  return String(v);
}

function anotarInfo(libro, datos) {
  var hoja = libro.getSheetByName(PESTANA_INFO);
  if (!hoja) return;
  var fila = Object.keys(PESTANAS).indexOf(datos.tabla) + 2;
  var col = datos.tipo === 'completo' ? 3 : 4;
  hoja.getRange(fila, col).setValue(new Date());
}

/* ------------------------------------------------------------------ */
/* Menú y puesta en marcha                                             */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Respaldo')
    .addItem('1. Preparar la hoja', 'preparar')
    .addItem('2. Conectar con la web (Supabase)', 'conectar')
    .addSeparator()
    .addItem('Hacer una copia del archivo ahora', 'copiaSemanal')
    .addItem('Cambiar la contraseña del buzón', 'nuevaContrasena')
    .addToUi();
}

// Crea las pestañas, la contraseña del buzón y la copia semanal.
function preparar() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('LIBRO', libro.getId());
  if (!props.getProperty('TOKEN')) props.setProperty('TOKEN', crearContrasena());

  Object.keys(PESTANAS).forEach(function (tabla) { obtenerPestana(libro, tabla); });

  var info = libro.getSheetByName(PESTANA_INFO) || libro.insertSheet(PESTANA_INFO);
  var filas = [['TABLA', 'PESTAÑA', 'ÚLTIMA COPIA COMPLETA', 'ÚLTIMO CAMBIO RECIBIDO']];
  Object.keys(PESTANAS).forEach(function (t) { filas.push([t, PESTANAS[t], '', '']); });
  info.getRange(1, 1, filas.length, 4).setValues(filas);
  info.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#e8eaf6');
  info.getRange(filas.length + 2, 1).setValue('Esta hoja es SOLO UNA COPIA. Lo que cambies aquí no cambia la web.');

  // Quita la «Hoja 1» vacía que trae todo archivo nuevo.
  ['Hoja 1', 'Sheet1'].forEach(function (n) {
    var h = libro.getSheetByName(n);
    if (h && h.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(h);
  });

  // Copia semanal (lunes, de madrugada).
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'copiaSemanal') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('copiaSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(6).create();

  SpreadsheetApp.getUi().alert('Hoja preparada. Ahora: Implementar › Nueva implementación › Aplicación web (ver la guía), y después «Respaldo › 2. Conectar con la web».');
}

// Pide la dirección de la aplicación web y muestra la línea que hay que pegar en Supabase.
function conectar() {
  var ui = SpreadsheetApp.getUi();
  var token = PropertiesService.getScriptProperties().getProperty('TOKEN');
  if (!token) { ui.alert('Primero usa «Respaldo › 1. Preparar la hoja».'); return; }

  var r = ui.prompt('Conectar con la web',
    'Pega la dirección de la aplicación web (la que termina en /exec):', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var url = r.getResponseText().trim();
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
    ui.alert('Esa dirección no vale: tiene que empezar por https://script.google.com/macros/s/ y terminar en /exec.');
    return;
  }

  var sql = "select respaldo.configurar('" + url + "', '" + token + "');";
  var html = HtmlService.createHtmlOutput(
    '<p style="font-family:Arial">Copia esta línea y pégala en Supabase › <b>SQL Editor</b> › <b>Run</b>:</p>' +
    '<textarea id="t" style="width:100%;height:110px;font-family:monospace" readonly>' + sql + '</textarea>' +
    '<p><button onclick="var t=document.getElementById(\'t\');t.select();document.execCommand(\'copy\');this.innerText=\'Copiado ✔\'">Copiar</button></p>' +
    '<p style="font-family:Arial;color:#a00">No la compartas: lleva la contraseña del buzón.</p>'
  ).setWidth(560).setHeight(280);
  ui.showModalDialog(html, 'Línea para Supabase');
}

function nuevaContrasena() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('¿Cambiar la contraseña?', 'La web dejará de enviar datos hasta que vuelvas a hacer «2. Conectar con la web».', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('TOKEN', crearContrasena());
  conectar();
}

function crearContrasena() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/* ------------------------------------------------------------------ */
/* Copia semanal del archivo entero                                    */
/* ------------------------------------------------------------------ */

function copiaSemanal() {
  var id = PropertiesService.getScriptProperties().getProperty('LIBRO');
  if (!id) return;
  var archivo = DriveApp.getFileById(id);
  var carpetas = DriveApp.getFoldersByName(CARPETA_COPIAS);
  var carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_COPIAS);
  var fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  archivo.makeCopy(archivo.getName() + ' · copia ' + fecha, carpeta);

  // Se quedan solo las más recientes.
  var copias = [];
  var it = carpeta.getFiles();
  while (it.hasNext()) copias.push(it.next());
  copias.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  copias.slice(COPIAS_A_GUARDAR).forEach(function (f) { f.setTrashed(true); });
}
