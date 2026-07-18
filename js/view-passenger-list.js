// ============================================================
// view-passenger-list.js — Lista de pasajeros exportable (panel admin)
// Genera los PDFs vía Apps Script (plantilla de Google Docs), que
// arma la tabla y devuelve un PDF por cada hoja de PAX_ROWS_PER_SHEET
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
    `${total} pasajero${total === 1 ? '' : 's'} — se generará${PaxListState.sheetsCount === 1 ? '' : 'n'} ${PaxListState.sheetsCount} PDF${PaxListState.sheetsCount === 1 ? '' : 's'} (${PAX_ROWS_PER_SHEET} por hoja)`;
}

/** Pide al Apps Script que genere los PDFs y los descarga. */
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
      redirect: 'follow',
      // Sin Content-Type explícito: al mandar un string como body, fetch
      // usa "text/plain;charset=UTF-8" por defecto, que es justamente el
      // patrón recomendado para Apps Script — evita el preflight CORS de
      // forma más consistente entre navegadores que fijarlo a mano.
      body: JSON.stringify({
        viaje: viaje.nombre,
        pasajeros: PaxListState.passengers
      })
    });

    if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);

    const data = await response.json();
    if (!data.ok) throw new Error((data.error || 'Error desconocido del generador') + (data.stack ? '\n' + data.stack : ''));

    const hojas = data.hojas || [];
    if (!hojas.length) throw new Error('El generador no devolvió PDFs');

    for (const hoja of hojas) {
      _descargarBase64Pdf(hoja.base64, hoja.filename);
      // Pequeña pausa entre descargas: algunos navegadores mobile
      // (Samsung Browser incluido) descartan descargas disparadas
      // demasiado rápido una tras otra.
      await new Promise(r => setTimeout(r, 400));
    }

    const diag = (data.diagnostico || []).join(' | ');
    toast((hojas.length === 1 ? 'PDF generado' : `${hojas.length} PDFs generados`) + (diag ? ' — ' + diag : ''));
  } catch (e) {
    console.error(e);
    const esErrorDeRed = e instanceof TypeError; // fetch lanza TypeError puro cuando el request es bloqueado (CORS, mixed content, sin conexión) antes de llegar al servidor
    const mensaje = esErrorDeRed
      ? 'No se pudo conectar con el generador. Revisá que la URL del Apps Script sea correcta y que la implementación esté publicada como "Cualquier usuario".'
      : 'Error al generar la lista: ' + (e.message || '');
    toast(mensaje);
  } finally {
    hideLoading();
  }
}

function _descargarBase64Pdf(base64, filename) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });

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
