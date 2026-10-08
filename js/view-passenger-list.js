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

    await _entregarPdfs(hojas);

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

/** Pide al Apps Script que genere los PDFs de la lista del chofer
 *  (formato resumido, 64 pasajeros por hoja) y los descarga.
 *  Reutiliza PaxListState.passengers, ya calculado por _loadAllPassengers
 *  con el mismo criterio de numeración que usa el croquis. */
async function exportChoferListImages() {
  if (!PAX_APPSCRIPT_URL || PAX_APPSCRIPT_URL.includes('PEGAR_AQUI')) {
    toast('Falta configurar la URL del Apps Script (PAX_APPSCRIPT_URL)');
    return;
  }

  const viaje = PaxListState.viaje;
  showLoading('Generando lista del chofer…');
  try {
    const response = await fetch(PAX_APPSCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify({
        tipo: 'chofer',
        viaje: viaje.nombre,
        pasajeros: PaxListState.passengers
      })
    });

    if (!response.ok) throw new Error('Respuesta HTTP ' + response.status);

    const data = await response.json();
    if (!data.ok) throw new Error((data.error || 'Error desconocido del generador') + (data.stack ? '\n' + data.stack : ''));

    const hojas = data.hojas || [];
    if (!hojas.length) throw new Error('El generador no devolvió PDFs');

    await _entregarPdfs(hojas);

    const diag = (data.diagnostico || []).join(' | ');
    toast((hojas.length === 1 ? 'PDF generado' : `${hojas.length} PDFs generados`) + (diag ? ' — ' + diag : ''));
  } catch (e) {
    console.error(e);
    const esErrorDeRed = e instanceof TypeError;
    const mensaje = esErrorDeRed
      ? 'No se pudo conectar con el generador. Revisá que la URL del Apps Script sea correcta y que la implementación esté publicada como "Cualquier usuario".'
      : 'Error al generar la lista del chofer: ' + (e.message || '');
    toast(mensaje);
  } finally {
    hideLoading();
  }
}

/**
 * Entrega los PDFs generados al usuario.
 * - 1 PDF, o escritorio: descarga directa (con pausa entre descargas).
 * - Varios PDFs en celular: el navegador solo permite una descarga por
 *   gesto del usuario (las demás se descartan sin aviso), así que se
 *   muestra un panel con un botón por PDF; cada toque es un gesto nuevo.
 */
async function _entregarPdfs(hojas) {
  const esTactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (hojas.length === 1 || !esTactil) {
    for (const hoja of hojas) {
      _descargarBase64Pdf(hoja.base64, hoja.filename);
      await new Promise(r => setTimeout(r, 400));
    }
    return;
  }
  hideLoading();
  await _mostrarPanelDescargas(hojas);
}

function _mostrarPanelDescargas(hojas) {
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.className = 'overlay show';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.style.zIndex = '400';

    const box = document.createElement('div');
    box.className = 'loader';
    box.style.cssText = 'flex-direction:column;align-items:stretch;gap:10px;width:min(88vw,360px);';

    const title = document.createElement('div');
    title.className = 'loader-text';
    title.textContent = `${hojas.length} PDFs listos — tocá cada uno para descargarlo`;
    box.appendChild(title);

    hojas.forEach(hoja => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn primary';
      btn.textContent = '⬇ ' + hoja.filename;
      btn.style.cssText = 'overflow-wrap:anywhere;text-align:left;';
      btn.onclick = () => {
        _descargarBase64Pdf(hoja.base64, hoja.filename);
        btn.className = 'btn ghost';
        btn.textContent = '✓ ' + hoja.filename;
      };
      box.appendChild(btn);
    });

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn ghost';
    close.textContent = 'Cerrar';
    close.onclick = () => { ov.remove(); resolve(); };
    box.appendChild(close);

    ov.appendChild(box);
    document.body.appendChild(ov);
  });
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
  // Revocar de inmediato puede cortar la descarga en navegadores móviles.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

window.goPassengerList = goPassengerList;
window.exportPassengerListImages = exportPassengerListImages;
window.exportChoferListImages = exportChoferListImages;
