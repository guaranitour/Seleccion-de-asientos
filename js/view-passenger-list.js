// ============================================================
// view-passenger-list.js — Lista de pasajeros exportable (panel admin)
// Genera las imágenes vía Apps Script (plantilla de Google Slides),
// que arma la tabla y devuelve un PNG por cada hoja de PAX_ROWS_PER_SHEET
// pasajeros. Reemplaza al flujo anterior basado en html2canvas.
// ============================================================

// URL del Apps Script desplegado como Web App (terminación /exec).
// Ver appscript/Code.gs para el código del backend.
const PAX_APPSCRIPT_URL = 'PEGAR_AQUI_LA_URL_/exec_DEL_APPS_SCRIPT';

const PaxListState = {
  viaje: null,
  passengers: [],   // lista continua [{ numero, documento, nombre }]
  sheetsCount: 0     // cuántas hojas va a generar el Apps Script (solo informativo)
};

const PAX_ROWS_PER_SHEET = 32;

async function goPassengerList(viaje) {
  if (!Auth.isAuthorized()) { goStaffLogin(); return; }

  PaxListState.viaje = viaje;
  PaxListState.passengers = [];
  PaxListState.sheetsCount = 0;

  showView('view-passenger-list');
  document.getElementById('paxTripName').textContent = viaje.nombre;

  showLoading('Cargando pasajeros…');
  try {
    await _loadAllPassengers();
    _renderSummary();
  } catch (e) {
    console.error(e);
    toast('Error al cargar la lista de pasajeros');
  } finally {
    hideLoading();
  }
  setHash(['Panel', 'Lista', viaje.nombre]);
}

/** Trae los asientos ocupados de TODAS las plantas del viaje (en orden)
 *  y arma una lista continua de pasajeros numerada. */
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

  PaxListState.passengers = allPassengers.map((p, i) => ({
    numero: i + 1,
    documento: p.documento,
    nombre: p.nombre
  }));
  PaxListState.sheetsCount = Math.max(1, Math.ceil(allPassengers.length / PAX_ROWS_PER_SHEET));
}

function _renderSummary() {
  const total = PaxListState.passengers.length;
  document.getElementById('paxMeta').textContent =
    `${total} pasajero${total === 1 ? '' : 's'} — se generará${PaxListState.sheetsCount === 1 ? '' : 'n'} ${PaxListState.sheetsCount} imagen${PaxListState.sheetsCount === 1 ? '' : 'es'} (${PAX_ROWS_PER_SHEET} por hoja)`;
}

/** Pide al Apps Script que genere las imágenes y las descarga. */
async function exportPassengerListImages() {
  if (!PAX_APPSCRIPT_URL || PAX_APPSCRIPT_URL.includes('PEGAR_AQUI')) {
    toast('Falta configurar la URL del Apps Script (PAX_APPSCRIPT_URL)');
    return;
  }

  const viaje = PaxListState.viaje;
  showLoading('Generando lista de pasajeros…');
  try {
    const response = await fetch(PAX_APPSCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS contra Apps Script
      body: JSON.stringify({
        viaje: viaje.nombre,
        pasajeros: PaxListState.passengers
      })
    });

    if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);

    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido del generador');

    const hojas = data.hojas || [];
    if (!hojas.length) throw new Error('El generador no devolvió imágenes');

    for (const hoja of hojas) {
      _descargarBase64Png(hoja.base64, hoja.filename);
      // Pequeña pausa entre descargas: algunos navegadores mobile
      // (Samsung Browser incluido) descartan descargas disparadas
      // demasiado rápido una tras otra.
      await new Promise(r => setTimeout(r, 400));
    }

    toast(hojas.length === 1 ? 'Imagen generada' : `${hojas.length} imágenes generadas`);
  } catch (e) {
    console.error(e);
    toast('Error al generar la lista: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

function _descargarBase64Png(base64, filename) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/png' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.goPassengerList = goPassengerList;
window.exportPassengerListImages = exportPassengerListImages;
