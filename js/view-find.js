// ============================================================
// view-find.js — "Mirá tu asiento": búsqueda pública por CI
// ============================================================

function _findSeatSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M8 6V4M16 6V4"/>
    <circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/>
  </svg>`;
}

function _findEmptySvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v4M11 16h.01"/>
  </svg>`;
}

function goFind() {
  if (!AppState.viaje) { toast('Elegí un viaje primero'); return; }
  clearFindView();
  updateTripTags();
  showView('view-find');
}

function clearFindView() {
  const area = document.getElementById('findResultArea');
  const grid = document.getElementById('grid-find');
  const note = document.getElementById('findCroquisNote');
  if (area) area.innerHTML = '';
  if (grid) { grid.innerHTML = ''; grid.style.display = 'none'; }
  if (note) note.style.display = 'none';
  AppState.highlightCodes = new Set();

  const ciInput = document.getElementById('ciSearch');
  if (ciInput) ciInput.value = '';
}

/** Busca todos los asientos con ese CI, en todas las plantas del viaje. */
async function findByCI() {
  const ciInput = document.getElementById('ciSearch');
  const ci = ciInput ? ciInput.value.trim() : '';
  if (!ci) { toast('Ingresá tu CI'); return; }

  showLoading('Buscando…');
  try {
    const rows = await Api.getAsientosByCi(AppState.viaje.id, ci);
    await _renderFindResults(rows);
  } catch (e) {
    console.error(e);
    toast('Error al buscar por CI');
  } finally {
    hideLoading();
  }
}

async function _renderFindResults(rows) {
  const area = document.getElementById('findResultArea');
  if (!area) return;
  area.innerHTML = '';

  if (!rows.length) {
    area.innerHTML = `
      <div class="find-empty">
        <div class="find-empty-icon">${_findEmptySvg()}</div>
        <div class="find-empty-title">No encontramos tu asiento</div>
        <div class="find-empty-sub">No hay asientos registrados para ese documento en este viaje. Verificá el número e intentá de nuevo.</div>
      </div>`;
    return;
  }

  // Agrupar por planta (para calcular numeración visible correcta de cada una)
  const byPlanta = new Map();
  rows.forEach(r => {
    const pid = r.planta_id;
    if (!byPlanta.has(pid)) byPlanta.set(pid, { planta: r.plantas, rows: [] });
    byPlanta.get(pid).rows.push(r);
  });

  const pasajero = rows.find(r => r.pasajero)?.pasajero || '';
  const resultsDiv = document.createElement('div');
  resultsDiv.className = 'find-results';

  const isMultiFloor = AppState.viaje.plantas.length > 1;

  // Elegir la primera planta con resultados como planta "visible" en el croquis
  let firstPlantaId = null;

  for (const [plantaId, group] of byPlanta) {
    if (!firstPlantaId) firstPlantaId = plantaId;

    // Traer todos los asientos de esa planta para calcular numeración
    const allSeats = await Api.getAsientosByPlanta(plantaId);
    const seatsMap = new Map();
    allSeats.forEach(s => seatsMap.set(normalize(s.code), { estado: s.estado }));

    const rowsToRender = _getRowsFromMap(seatsMap);
    const numLabels = new Map();
    let seatNumber = 1;
    rowsToRender.forEach(row => {
      ['A', 'B', 'C', 'D'].forEach(letter => {
        const code = row + letter;
        const norm = normalize(code);
        const seat = seatsMap.get(norm);
        const state = !seat ? 'inexistente' : (seat.estado === 'ocupado' ? 'ocupado' : (seat.estado === 'inhabilitado' ? 'inhabilitado' : 'libre'));
        if (state === 'libre' || state === 'ocupado') { numLabels.set(norm, seatNumber); seatNumber++; }
      });
    });

    group.rows.forEach(r => {
      const norm = normalize(r.code);
      const num = numLabels.get(norm) || r.code;
      AppState.highlightCodes.add(norm);

      const card = document.createElement('div');
      card.className = 'find-card';
      card.innerHTML = `
        <div class="find-card-badge">${_findSeatSvg()}</div>
        <div class="find-card-info">
          <div class="find-card-num">Asiento ${num}</div>
          ${pasajero ? `<div class="find-card-name">${pasajero}</div>` : ''}
          ${isMultiFloor && group.planta ? `<div class="find-card-floor">${getFloorLabelFromEtiqueta(group.planta.etiqueta)}</div>` : ''}
        </div>`;
      resultsDiv.appendChild(card);
    });
  }

  area.appendChild(resultsDiv);

  const croquisWrap = document.createElement('div');
  croquisWrap.className = 'find-croquis-wrap';
  croquisWrap.innerHTML = '<div class="find-croquis-title">Tu ubicación en el bus</div>';

  const grid = document.getElementById('grid-find');
  if (grid) { grid.style.display = ''; croquisWrap.appendChild(grid); }
  const note = document.getElementById('findCroquisNote');
  if (note) { note.style.display = ''; croquisWrap.appendChild(note); }
  area.appendChild(croquisWrap);

  // Mostrar el croquis de la primera planta con resultados
  if (firstPlantaId) {
    const plantaInfo = byPlanta.get(firstPlantaId).planta;
    AppState.planta = { id: firstPlantaId, etiqueta: plantaInfo ? plantaInfo.etiqueta : '' };

    showLoading('Cargando croquis…');
    await refreshSeats('grid-find', { hideMissing: true });
    hideLoading();

    const mine = document.getElementById('grid-find').querySelector('.seat.mine');
    if (mine) mine.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else croquisWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function _getRowsFromMap(seatsMap) {
  const rows = new Set();
  seatsMap.forEach((seat, code) => {
    const m = code.match(/^(\d+)[A-Z]$/);
    if (!m) return;
    if ((seat.estado || '').toLowerCase() !== 'inhabilitado') rows.add(parseInt(m[1], 10));
  });
  return Array.from(rows).sort((a, b) => a - b);
}

window.goFind = goFind;
window.clearFindView = clearFindView;
window.findByCI = findByCI;
