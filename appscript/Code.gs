/**
 * ============================================================
 * Code.gs — Generador de "Lista de pasajeros" (PDF) desde plantilla
 * de Google Docs, para Destino Guaraní.
 *
 * Reemplaza el enfoque anterior basado en Google Slides (que tenía
 * problemas de control de alto de fila en tablas) por Google Docs,
 * que pagina automáticamente y da mejor control de tablas.
 *
 * Flujo:
 *   1) El frontend hace POST con el JSON de pasajeros.
 *   2) Por cada bloque de PAX_POR_HOJA pasajeros, este script duplica
 *      el documento plantilla, completa {{VIAJE}} y clona la fila
 *      plantilla de la tabla (la que tiene {{Nro}}, {{Documento}},
 *      {{Nombre}}, {{Abonado}}, {{Por abonar}}) una vez por pasajero,
 *      hasta completar 32 filas (vacías si sobran, para completar a
 *      mano).
 *   3) Exporta cada documento generado como PDF y lo devuelve en
 *      base64.
 *   4) Borra los documentos temporales (no ensucia la plantilla).
 *
 * DESPLIEGUE
 *   Extensiones → Apps Script (o script.google.com → Nuevo proyecto)
 *   1. Pegar este archivo como Code.gs
 *   2. Completar PLANTILLA_DOC_ID más abajo
 *   3. Implementar → Nueva implementación → Tipo: Aplicación web
 *        - Ejecutar como: Yo (tu cuenta, la que tiene acceso al Doc)
 *        - Quién tiene acceso: Cualquier usuario
 *   4. Copiar la URL /exec resultante → pegarla en PAX_APPSCRIPT_URL
 *      dentro de view-passenger-list.js del frontend.
 *
 * CONTRATO (request → response)
 * -------------------------------------------------------------
 * POST body (JSON):
 * {
 *   "viaje": "Asunción → Encarnación 15/08",
 *   "pasajeros": [
 *     { "numero": 1, "documento": "1234567", "nombre": "Juan Pérez",
 *       "abonado": 200000, "por_abonar": 250000 },   // abonado/por_abonar opcionales
 *     ...
 *   ]
 * }
 *
 * Response 200 (JSON):
 * {
 *   "ok": true,
 *   "hojas": [
 *     { "index": 1, "total": 2, "filename": "...-hoja1.pdf", "base64": "..." },
 *     { "index": 2, "total": 2, "filename": "...-hoja2.pdf", "base64": "..." }
 *   ],
 *   "diagnostico": [ "..." ]
 * }
 *
 * Response error:
 * { "ok": false, "error": "mensaje", "stack": "...", "diagnostico": [...] }
 * ============================================================
 */

// ID del Google Doc que sirve de plantilla (con {{VIAJE}} como texto y
// una tabla con fila de encabezados + 1 fila plantilla que contiene
// {{Nro}}, {{Documento}}, {{Nombre}}, {{Abonado}}, {{Por abonar}}).
// Se saca de la URL: https://docs.google.com/document/d/ESTE_ID/edit
const PLANTILLA_DOC_ID = '12bfJw2FEaBhMbzmwF54y7-qnxEKMzGnbbWDLa0ba2GY';

// Cuántos pasajeros entran por hoja/PDF (32 filas fijas, vacías si
// sobran, para completar a mano — igual que el flujo anterior).
const PAX_POR_HOJA = 32;

// Índice de la fila plantilla dentro de la tabla (0 = encabezado,
// 1 = primera fila de datos, que es la que tiene los placeholders).
const FILA_PLANTILLA_INDEX = 1;

// ── Lista resumida para el chofer ───────────────────────────
// Misma estructura de plantilla (encabezado + 1 fila molde), pero con
// DOS bloques de columnas por fila: {{Nro}}/{{Documento}}/{{Nombre}}
// a la izquierda y {{Nro 2}}/{{Documento 2}}/{{Nombre 2}} a la
// derecha. Cada hoja entra 64 pasajeros: 1-32 en la columna
// izquierda (fila por fila) y 33-64 en la columna derecha.
const PLANTILLA_CHOFER_DOC_ID = '1qkHMSKgnYB3N3lfMx2ZzbEPuHBSdAYeJo4F5ryW7rjQ';
const PAX_POR_HOJA_CHOFER = 64;
const FILAS_POR_COLUMNA_CHOFER = PAX_POR_HOJA_CHOFER / 2; // 32
const FILA_PLANTILLA_INDEX_CHOFER = 1;

// Acumula avisos de diagnóstico (fallos no fatales) durante una
// ejecución, para poder verlos en el toast del frontend sin tener que
// entrar al log de Ejecuciones de Apps Script.
let DIAGNOSTICO = [];

function doPost(e) {
  DIAGNOSTICO = [];
  try {
    Logger.log('doPost recibido. e=%s', JSON.stringify({
      hasPostData: !!(e && e.postData),
      contentType: e && e.postData && e.postData.type,
      length: e && e.postData && e.postData.length
    }));

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No llegó el body del POST (postData vacío) — probablemente el request se convirtió en GET en el camino (redirect de Apps Script).');
    }

    const body = JSON.parse(e.postData.contents || '{}');
    const viajeNombre = String(body.viaje || '').trim();
    const pasajeros = Array.isArray(body.pasajeros) ? body.pasajeros : [];
    const tipo = String(body.tipo || 'pasajeros').trim().toLowerCase();

    if (!viajeNombre) throw new Error('Falta el nombre del viaje');

    const hojas = (tipo === 'chofer')
      ? _generarHojasChofer(viajeNombre, pasajeros)
      : _generarHojas(viajeNombre, pasajeros);

    return _jsonResponse({ ok: true, hojas: hojas, diagnostico: DIAGNOSTICO });
  } catch (err) {
    Logger.log('ERROR en doPost: %s', err && err.stack || err);
    return _jsonResponse({ ok: false, error: String(err && err.message || err), stack: String(err && err.stack || ''), diagnostico: DIAGNOSTICO });
  }
}

// Permite probar rápido abriendo la URL /exec en el navegador (GET).
function doGet(e) {
  return ContentService.createTextOutput(
    'Destino Guaraní · Generador de lista de pasajeros (PDF). Usar POST con JSON.'
  ).setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Genera un PDF por cada bloque de PAX_POR_HOJA lugares. Los
 * pasajeros llegan con su número de asiento real (puede tener huecos:
 * solo se envían los ocupados), así que agrupamos por RANGO de número
 * — no por posición en el array — para que cada uno caiga en la hoja
 * y fila que le corresponde según su asiento.
 */
function _generarHojas(viajeNombre, pasajeros) {
  const maxNumero = pasajeros.length ? Math.max(...pasajeros.map(p => Number(p.numero) || 0)) : 0;
  const totalHojas = Math.max(1, Math.ceil(maxNumero / PAX_POR_HOJA));

  const bloques = [];
  for (let h = 0; h < totalHojas; h++) {
    const desde = h * PAX_POR_HOJA + 1;
    const hasta = (h + 1) * PAX_POR_HOJA;
    const rows = pasajeros.filter(p => {
      const n = Number(p.numero) || 0;
      return n >= desde && n <= hasta;
    });
    bloques.push({ rows: rows, startNumber: desde });
  }

  const viajeSlug = viajeNombre.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
  const hojasResult = [];

  bloques.forEach((bloque, idx) => {
    const docTemporalId = _construirDocHoja(viajeNombre, bloque, idx, totalHojas);

    const pdfBlob = DriveApp.getFileById(docTemporalId).getAs('application/pdf');

    const filename = totalHojas > 1
      ? `lista-pasajeros-${viajeSlug}-hoja${idx + 1}.pdf`
      : `lista-pasajeros-${viajeSlug}.pdf`;

    hojasResult.push({
      index: idx + 1,
      total: totalHojas,
      filename: filename,
      base64: Utilities.base64Encode(pdfBlob.getBytes())
    });

    // Limpieza: no dejamos el documento temporal en Drive.
    DriveApp.getFileById(docTemporalId).setTrashed(true);
  });

  return hojasResult;
}

/**
 * Duplica el documento plantilla, reemplaza {{VIAJE}}, y completa la
 * tabla clonando la fila plantilla una vez por pasajero (hasta 32,
 * dejando filas vacías si sobran). Devuelve el ID del doc temporal ya
 * guardado (listo para exportar a PDF).
 */
function _construirDocHoja(viajeNombre, bloque, idx, totalHojas) {
  DIAGNOSTICO.push(`Hoja ${idx + 1}/${totalHojas}: bloque con ${bloque.rows.length} pasajero(s), startNumber=${bloque.startNumber}.`);

  const nombreCopia = `[TEMP] Lista pasajeros ${viajeNombre} - hoja ${idx + 1}`;
  const copiaFile = DriveApp.getFileById(PLANTILLA_DOC_ID).makeCopy(nombreCopia);
  const doc = DocumentApp.openById(copiaFile.getId());
  const body = doc.getBody();

  body.replaceText('\\{\\{VIAJE\\}\\}', String(viajeNombre).replace(/\$/g, '$$$$'));

  const tables = body.getTables();
  if (!tables.length) throw new Error('No se encontró ninguna tabla en la plantilla del documento');
  const table = tables[0];

  const filaPlantilla = table.getRow(FILA_PLANTILLA_INDEX);
  if (!filaPlantilla) throw new Error(`No se encontró la fila plantilla (índice ${FILA_PLANTILLA_INDEX}) en la tabla`);

  // Armamos un mapa numero → pasajero para ubicar cada uno en SU fila
  // exacta de la hoja (no de forma secuencial), ya que bloque.rows
  // puede tener huecos (solo llegan los asientos ocupados).
  const paxPorNumero = new Map();
  bloque.rows.forEach(p => paxPorNumero.set(Number(p.numero), p));

  // Clonamos la fila plantilla PAX_POR_HOJA veces (una por cada lugar
  // de la hoja), completando con los datos reales o dejándola vacía si
  // no hay pasajero para ese lugar.
  for (let i = 0; i < PAX_POR_HOJA; i++) {
    const rowNumber = bloque.startNumber + i;
    const pax = paxPorNumero.get(rowNumber);

    const nuevaFila = filaPlantilla.copy();
    table.appendTableRow(nuevaFila);

    _reemplazarEnFila(nuevaFila, '{{Nro}}', String(rowNumber));
    _reemplazarEnFila(nuevaFila, '{{Documento}}', pax ? _formatearDocumento(pax.documento) : '');
    _reemplazarEnFila(nuevaFila, '{{Nombre}}', pax ? String(pax.nombre || '') : '');
    // Montos traídos de la app (cruce por CI). Sin dato, la celda queda vacía
    // para completar a mano, como siempre.
    _reemplazarEnFila(nuevaFila, '{{Abonado}}', pax ? _formatearMonto(pax.abonado) : '');
    _reemplazarEnFila(nuevaFila, '{{Por abonar}}', pax ? _formatearMonto(pax.por_abonar) : '');
  }

  // La fila plantilla original (con los placeholders sin reemplazar)
  // ya cumplió su propósito de molde — la quitamos para que no quede
  // una fila extra con literales "{{Nro}}" etc. en el PDF final.
  table.removeRow(FILA_PLANTILLA_INDEX);

  doc.saveAndClose();

  return copiaFile.getId();
}

/**
 * Reemplaza un placeholder dentro de una fila de tabla ya clonada.
 * TableRow no tiene replaceText propio, así que lo hacemos celda por
 * celda usando editAsText().
 */
function _reemplazarEnFila(fila, marcador, valor) {
  const numCeldas = fila.getNumCells();
  // $ tiene significado especial como referencia a grupo de captura en
  // el string de reemplazo de replaceText — lo escapamos para que un
  // nombre o documento que por casualidad contenga "$1" etc. no rompa
  // el reemplazo.
  const valorSeguro = String(valor).replace(/\$/g, '$$$$');
  for (let c = 0; c < numCeldas; c++) {
    const celda = fila.getCell(c);
    if (celda.getText().indexOf(marcador) !== -1) {
      celda.editAsText().replaceText(_escapeRegex(marcador), valorSeguro);
      return;
    }
  }
}

function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Formatea un número de documento con separador de miles (puntos),
 * ej. "1234567" → "1.234.567". Si el valor no es puramente numérico
 * (viene con guiones, letras, espacios, etc.) se devuelve tal cual,
 * para no romper documentos con formato no estándar.
 */
function _formatearDocumento(valor) {
  const str = String(valor || '').trim();
  if (!str || !/^\d+$/.test(str)) return str;
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Formatea un monto en guaraníes con separador de miles, ej. 450000 →
 * "450.000". Si no viene dato (undefined/null/''/no numérico) devuelve
 * '' para dejar la celda vacía. 0 se muestra como "0".
 */
function _formatearMonto(valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  const n = Number(valor);
  if (!isFinite(n)) return '';
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ============================================================
// Lista resumida para el chofer — 64 pasajeros por hoja, en dos
// columnas de 32 filas (izquierda: 1-32, derecha: 33-64).
// ============================================================

/**
 * Genera un PDF por cada bloque de PAX_POR_HOJA_CHOFER (64) lugares.
 * Mismo criterio que _generarHojas: se agrupa por RANGO de número de
 * asiento (no por posición en el array), para que cada pasajero caiga
 * en la hoja que le corresponde según su asiento real.
 */
function _generarHojasChofer(viajeNombre, pasajeros) {
  const maxNumero = pasajeros.length ? Math.max(...pasajeros.map(p => Number(p.numero) || 0)) : 0;
  const totalHojas = Math.max(1, Math.ceil(maxNumero / PAX_POR_HOJA_CHOFER));

  const bloques = [];
  for (let h = 0; h < totalHojas; h++) {
    const desde = h * PAX_POR_HOJA_CHOFER + 1;
    const hasta = (h + 1) * PAX_POR_HOJA_CHOFER;
    const rows = pasajeros.filter(p => {
      const n = Number(p.numero) || 0;
      return n >= desde && n <= hasta;
    });
    bloques.push({ rows: rows, startNumber: desde });
  }

  const viajeSlug = viajeNombre.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
  const hojasResult = [];

  bloques.forEach((bloque, idx) => {
    const docTemporalId = _construirDocHojaChofer(viajeNombre, bloque, idx, totalHojas);

    const pdfBlob = DriveApp.getFileById(docTemporalId).getAs('application/pdf');

    const filename = totalHojas > 1
      ? `lista-chofer-${viajeSlug}-hoja${idx + 1}.pdf`
      : `lista-chofer-${viajeSlug}.pdf`;

    hojasResult.push({
      index: idx + 1,
      total: totalHojas,
      filename: filename,
      base64: Utilities.base64Encode(pdfBlob.getBytes())
    });

    // Limpieza: no dejamos el documento temporal en Drive.
    DriveApp.getFileById(docTemporalId).setTrashed(true);
  });

  return hojasResult;
}

/**
 * Duplica la plantilla del chofer, reemplaza {{VIAJE}}, y completa la
 * tabla clonando la fila plantilla una vez por CADA FILA de la hoja
 * (32 filas, ya que cada fila trae 2 pasajeros: uno en el bloque
 * izquierdo {{Nro}}/{{Documento}}/{{Nombre}} y otro en el derecho
 * {{Nro 2}}/{{Documento 2}}/{{Nombre 2}}).
 */
function _construirDocHojaChofer(viajeNombre, bloque, idx, totalHojas) {
  DIAGNOSTICO.push(`[Chofer] Hoja ${idx + 1}/${totalHojas}: bloque con ${bloque.rows.length} pasajero(s), startNumber=${bloque.startNumber}.`);

  const nombreCopia = `[TEMP] Lista chofer ${viajeNombre} - hoja ${idx + 1}`;
  const copiaFile = DriveApp.getFileById(PLANTILLA_CHOFER_DOC_ID).makeCopy(nombreCopia);
  const doc = DocumentApp.openById(copiaFile.getId());
  const body = doc.getBody();

  body.replaceText('\\{\\{VIAJE\\}\\}', String(viajeNombre).replace(/\$/g, '$$$$'));

  const tables = body.getTables();
  if (!tables.length) throw new Error('No se encontró ninguna tabla en la plantilla del chofer');
  const table = tables[0];

  const filaPlantilla = table.getRow(FILA_PLANTILLA_INDEX_CHOFER);
  if (!filaPlantilla) throw new Error(`No se encontró la fila plantilla (índice ${FILA_PLANTILLA_INDEX_CHOFER}) en la tabla del chofer`);

  const paxPorNumero = new Map();
  bloque.rows.forEach(p => paxPorNumero.set(Number(p.numero), p));

  // Una fila física de la tabla = 2 lugares (izquierda y derecha).
  // Izquierda: startNumber .. startNumber+31 (fila por fila)
  // Derecha:   startNumber+32 .. startNumber+63 (misma fila que su par izquierdo)
  for (let i = 0; i < FILAS_POR_COLUMNA_CHOFER; i++) {
    const numIzq = bloque.startNumber + i;
    const numDer = bloque.startNumber + FILAS_POR_COLUMNA_CHOFER + i;
    const paxIzq = paxPorNumero.get(numIzq);
    const paxDer = paxPorNumero.get(numDer);

    const nuevaFila = filaPlantilla.copy();
    table.appendTableRow(nuevaFila);

    _reemplazarEnFila(nuevaFila, '{{Nro}}', String(numIzq));
    _reemplazarEnFila(nuevaFila, '{{Documento}}', paxIzq ? _formatearDocumento(paxIzq.documento) : '');
    _reemplazarEnFila(nuevaFila, '{{Nombre}}', paxIzq ? String(paxIzq.nombre || '') : '');

    _reemplazarEnFila(nuevaFila, '{{Nro 2}}', String(numDer));
    _reemplazarEnFila(nuevaFila, '{{Documento 2}}', paxDer ? _formatearDocumento(paxDer.documento) : '');
    _reemplazarEnFila(nuevaFila, '{{Nombre 2}}', paxDer ? String(paxDer.nombre || '') : '');
  }

  // La fila plantilla original (con los placeholders sin reemplazar)
  // ya cumplió su propósito de molde.
  table.removeRow(FILA_PLANTILLA_INDEX_CHOFER);

  doc.saveAndClose();

  return copiaFile.getId();
}

function _jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}