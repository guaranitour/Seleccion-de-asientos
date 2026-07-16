// ============================================================
// view-passenger-list.js — Lista de pasajeros exportable (panel admin)
// Replica el diseño de la plantilla Word oficial. Pagina de a 35
// filas por hoja; si un viaje tiene más de una planta, la numeración
// de filas continúa entre plantas (no reinicia).
// ============================================================

const PaxListState = {
  viaje: null,
  sheets: [],     // [{ rows: [...], startNumber }]
  activeSheet: 0
};

const PAX_ROWS_PER_SHEET = 35;
// Ancho fijo (px) del contenedor offscreen usado para exportar cada hoja.
// 8.5in @150dpi. Con container queries (cqw en passenger-list.css), el
// tamaño de fuente se calcula contra ESTE ancho real sin importar cuán
// angosto sea el viewport del dispositivo — antes usaba vw (relativo al
// viewport), lo que producía texto ilegible al exportar desde mobile.
const PAX_EXPORT_WIDTH_PX = 1275;

async function goPassengerList(viaje) {
  if (!Auth.isAuthorized()) { goStaffLogin(); return; }

  PaxListState.viaje = viaje;
  PaxListState.sheets = [];
  PaxListState.activeSheet = 0;

  showView('view-passenger-list');
  document.getElementById('paxTripName').textContent = viaje.nombre;

  showLoading('Cargando pasajeros…');
  try {
    await _loadAllPassengers();
    _renderSheetNav();
    _renderActiveSheet();
  } catch (e) {
    console.error(e);
    toast('Error al cargar la lista de pasajeros');
  } finally {
    hideLoading();
  }
  setHash(['Panel', 'Lista', viaje.nombre]);
}

/** Trae los asientos ocupados de TODAS las plantas del viaje (en orden),
 *  arma una lista continua de pasajeros y la pagina de a 35. */
async function _loadAllPassengers() {
  const viaje = PaxListState.viaje;
  const plantas = Array.isArray(viaje.plantas) ? viaje.plantas : [];
  let allPassengers = [];

  for (const planta of plantas) {
    const rows = await ApiAdmin.getAsientosByPlanta(planta.id);
    const ocupados = rows
      .filter(r => (r.estado || '').toLowerCase() === 'ocupado')
      .sort((a, b) => (a.fila - b.fila) || String(a.letra).localeCompare(String(b.letra)))
      .map(r => ({
        documento: r.ci || '',
        nombre: r.pasajero || '',
        planta: planta.etiqueta
      }));
    allPassengers = allPassengers.concat(ocupados);
  }

  const sheets = [];
  for (let i = 0; i < allPassengers.length; i += PAX_ROWS_PER_SHEET) {
    sheets.push({
      rows: allPassengers.slice(i, i + PAX_ROWS_PER_SHEET),
      startNumber: i + 1
    });
  }
  // Si no hay pasajeros todavía, mostramos igual una hoja vacía para
  // que el staff pueda ver/exportar la plantilla lista para completar a mano.
  if (!sheets.length) sheets.push({ rows: [], startNumber: 1 });

  PaxListState.sheets = sheets;
}

function _renderSheetNav() {
  const nav = document.getElementById('paxSheetsNav');
  nav.innerHTML = '';

  const total = PaxListState.sheets.length;
  if (total <= 1) { nav.style.display = 'none'; return; }

  nav.style.display = '';
  PaxListState.sheets.forEach((sheet, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const from = sheet.startNumber;
    const to = sheet.startNumber + sheet.rows.length - 1;
    btn.textContent = `Hoja ${idx + 1} (${from}–${sheet.startNumber + PAX_ROWS_PER_SHEET - 1})`;
    btn.className = idx === PaxListState.activeSheet ? 'active' : '';
    btn.onclick = () => {
      PaxListState.activeSheet = idx;
      _renderSheetNav();
      _renderActiveSheet();
    };
    nav.appendChild(btn);
  });
}

function _renderActiveSheet() {
  const container = document.getElementById('paxSheetContainer');
  container.innerHTML = '';

  const total = PaxListState.sheets.length;
  const sheet = PaxListState.sheets[PaxListState.activeSheet];
  container.appendChild(_buildSheetEl(sheet, PaxListState.activeSheet, total));

  document.getElementById('paxMeta').textContent =
    `${_totalPassengers()} pasajero${_totalPassengers() === 1 ? '' : 's'} — ${total} hoja${total === 1 ? '' : 's'} para exportar`;
}

function _totalPassengers() {
  return PaxListState.sheets.reduce((sum, s) => sum + s.rows.length, 0);
}

/** Construye el DOM de una hoja (para preview Y para exportar son el mismo nodo). */
function _buildSheetEl(sheet, sheetIndex, totalSheets) {
  const viaje = PaxListState.viaje;

  const el = document.createElement('div');
  el.className = 'pax-sheet';
  el.id = 'paxSheetExport';

  el.innerHTML = `
    <div class="pax-sheet-header"><img src="assets/lista-header.png" alt=""></div>
    <div class="pax-sheet-tripname">${_escapeHtml(viaje.nombre)}</div>
    ${totalSheets > 1 ? `<div class="pax-sheet-pageflag">Hoja ${sheetIndex + 1}/${totalSheets}</div>` : ''}

    <div class="pax-table-header">
      <div class="pax-col pax-col-num"></div>
      <div class="pax-col pax-col-doc">Documento</div>
      <div class="pax-col pax-col-nombre">Nombre y apellido</div>
      <div class="pax-col pax-col-abonado">Abonado</div>
      <div class="pax-col pax-col-porabonar">Por abonar</div>
      <div class="pax-col pax-col-sub1"></div>
    </div>

    <div class="pax-table-body"></div>

    <div class="pax-sheet-footer"><img src="assets/lista-footer.png" alt=""></div>
  `;

  const body = el.querySelector('.pax-table-body');
  for (let i = 0; i < PAX_ROWS_PER_SHEET; i++) {
    const rowNumber = sheet.startNumber + i;
    const data = sheet.rows[i];
    const rowEl = document.createElement('div');
    rowEl.className = 'pax-row' + (data ? '' : ' empty');
    rowEl.innerHTML = `
      <div class="pax-col pax-col-num">${rowNumber}</div>
      <div class="pax-col pax-col-doc">${data ? _escapeHtml(data.documento) : ''}</div>
      <div class="pax-col pax-col-nombre">${data ? _escapeHtml(data.nombre) : ''}</div>
      <div class="pax-col pax-col-abonado"></div>
      <div class="pax-col pax-col-porabonar"></div>
      <div class="pax-col pax-col-sub1"></div>
    `;
    body.appendChild(rowEl);
  }

  return el;
}

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/** Exporta la hoja actualmente visible como PNG. */
async function exportActiveSheetAsPng() {
  await _exportSheetIndex(PaxListState.activeSheet);
}

/** Exporta TODAS las hojas del viaje como PNG (una descarga por hoja). */
async function exportAllSheetsAsPng() {
  for (let i = 0; i < PaxListState.sheets.length; i++) {
    await _exportSheetIndex(i);
    // Pequeña pausa entre descargas: algunos navegadores mobile
    // (Samsung Browser incluido) descartan descargas disparadas
    // demasiado rápido una tras otra.
    await new Promise(r => setTimeout(r, 400));
  }
}

async function _exportSheetIndex(index) {
  if (typeof html2canvas === 'undefined') {
    toast('No se pudo cargar el motor de exportación. Revisá tu conexión.');
    return;
  }
  const sheet = PaxListState.sheets[index];
  const total = PaxListState.sheets.length;

  showLoading(`Generando imagen ${index + 1}/${total}…`);
  try {
    // Renderizamos la hoja pedida fuera de pantalla a tamaño fijo de
    // alta resolución (no el tamaño responsive de la preview), para que
    // el PNG exportado tenga buena nitidez sin importar el viewport.
    const offscreen = document.createElement('div');
    offscreen.style.cssText = `position:fixed; left:-99999px; top:0; width:${PAX_EXPORT_WIDTH_PX}px;`;
    const sheetEl = _buildSheetEl(sheet, index, total);
    sheetEl.id = 'paxSheetExport-' + index;
    offscreen.appendChild(sheetEl);
    document.body.appendChild(offscreen);

    // Esperar a que las imágenes de fondo (header/footer) carguen antes
    // de capturar, si no el PNG sale con esos huecos en blanco.
    await _waitForImages(sheetEl);

    const canvas = await html2canvas(sheetEl, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      // Sin esto, html2canvas usa el viewport real del navegador (angosto
      // en mobile) para decidir qué se ve y qué queda "fuera de pantalla",
      // aunque el elemento offscreen mida PAX_EXPORT_WIDTH_PX de ancho real
      // — por eso la última columna se cortaba en el PNG exportado desde
      // el celular. windowWidth/width le dicen explícitamente el tamaño
      // real a capturar, ignorando el viewport del dispositivo.
      width: sheetEl.offsetWidth,
      height: sheetEl.offsetHeight,
      windowWidth: PAX_EXPORT_WIDTH_PX,
      x: 0,
      y: 0
    });
    document.body.removeChild(offscreen);

    const viajeSlug = (PaxListState.viaje.nombre || 'viaje').trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
    const fileName = total > 1
      ? `lista-pasajeros-${viajeSlug}-hoja${index + 1}.png`
      : `lista-pasajeros-${viajeSlug}.png`;

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (e) {
    console.error(e);
    const isTainted = String(e && e.message || '').toLowerCase().includes('tainted');
    toast(isTainted
      ? 'No se pudo generar la imagen (el logo debe servirse desde el mismo sitio, no como archivo local).'
      : 'Error al generar la imagen');
  } finally {
    hideLoading();
  }
}

function _waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  return Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

window.goPassengerList = goPassengerList;
window.exportActiveSheetAsPng = exportActiveSheetAsPng;
window.exportAllSheetsAsPng = exportAllSheetsAsPng;
