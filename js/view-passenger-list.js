// ============================================================
// view-passenger-list.js — Lista de pasajeros exportable (panel admin)
// Genera los PDFs vía Apps Script (plantilla de Google Docs), que
// arma la tabla y devuelve un PDF por cada hoja de PAX_ROWS_PER_SHEET
// pasajeros. Reemplaza al flujo anterior basado en html2canvas.
// ============================================================

// URL del Apps Script desplegado como Web App (terminación /exec).
// Ver appscript/Code.gs para el código del backend.
const PAX_APPSCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxf3JtCHJRsM53SpJwJJZ_yIOQhjzFY0eDZM0oj34wscMklLOf1aexAYQYh1wnik75XXQ/exec';

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

/** Trae los asientos de TODAS las plantas del viaje y calcula, para
 *  cada pasajero, el número de asiento real (1..N continuo entre
 *  plantas) — el mismo número que se ve en la grilla de asientos del
 *  panel de control: se agrupan por fila, se recorren en el orden
 *  A,B,C,D, y los asientos inhabilitados no cuentan (no consumen
 *  número). Los pasajeros quedan ubicados en la fila de la lista que
 *  corresponde a SU número de asiento, no de forma secuencial. */
async function _loadAllPassengers() {
  const viaje = PaxListState.viaje;
  const plantas = Array.isArray(viaje.plantas) ? viaje.plantas : [];
  const passengers = []; // [{ numero, documento, nombre }] — numero = asiento real
  let seatNumber = 1;

  for (const planta of plantas) {
    const rows = await ApiAdmin.getAsientosByPlanta(planta.id);

    const rowsMap = new Map();
    rows.forEach(r => {
      if (!rowsMap.has(r.fila)) rowsMap.set(r.fila, []);
      rowsMap.get(r.fila).push(r);
    });

    const filas = Array.from(rowsMap.keys()).sort((a, b) => a - b);

    filas.forEach(fila => {
      const seatsInRow = rowsMap.get(fila).sort((a, b) => String(a.letra).localeCompare(String(b.letra)));
      ['A', 'B', 'C', 'D'].forEach(letra => {
        const seat = seatsInRow.find(s => s.letra === letra);
        if (!seat) return; // posición sin asiento físico en esa fila: no consume número
        if ((seat.estado || '').toLowerCase() === 'inhabilitado') return; // no consume número, igual que en la grilla

        if ((seat.estado || '').toLowerCase() === 'ocupado') {
          passengers.push({
            numero: seatNumber,
            documento: seat.ci || '',
            nombre: seat.pasajero || ''
          });
        }
        seatNumber++;
      });
    });
  }

  PaxListState.passengers = passengers;
  const maxNumero = seatNumber - 1; // total de lugares numerables (ocupados o no) del viaje
  PaxListState.sheetsCount = Math.max(1, Math.ceil(maxNumero / PAX_ROWS_PER_SHEET));
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
