// ============================================================
// seats-grid.js — Croquis de asientos: carga, render, selección,
// numeración y sincronización en tiempo real (Supabase Realtime)
// ============================================================

/** Trae los asientos de la planta activa y arma el mapa local. */
async function refreshSeats(targetId, gridOptions) {
  if (!AppState.planta) return;
  AppState.gridLoading = true;
  const gridEl = targetId ? document.getElementById(targetId) : null;
  if (gridEl) gridEl.setAttribute('aria-busy', 'true');

  try {
    const rows = await Api.getAsientosByPlanta(AppState.planta.id);
    AppState.seatsByCode = new Map();
    rows.forEach(r => {
      AppState.seatsByCode.set(normalize(r.code), {
        id: r.id, estado: r.estado, pasajero: r.pasajero || '', ci: r.ci || ''
      });
    });
    if (gridEl) buildGrid(targetId, gridOptions);
  } catch (err) {
    console.error('refreshSeats error:', err);
    toast('Error al cargar asientos');
    if (gridEl) buildGrid(targetId, gridOptions);
  } finally {
    AppState.gridLoading = false;
  }
}

async function refreshSeatsWithSpinner(targetId, gridOptions) {
  showLoading('Actualizando asientos…');
  await refreshSeats(targetId, gridOptions);
  hideLoading();
}

function getRowsToRender() {
  const rows = new Set();
  AppState.seatsByCode.forEach((seat, code) => {
    const m = code.match(/^(\d+)[A-Z]$/);
    if (!m) return;
    const estado = (seat.estado || '').toLowerCase();
    if (estado !== 'inhabilitado') rows.add(parseInt(m[1], 10));
  });
  return Array.from(rows).sort((a, b) => a - b);
}

function getSeatState(code) {
  const key = normalize(code);
  const s = AppState.seatsByCode.get(key);
  if (!s) return 'inexistente';
  const st = (s.estado || '').toLowerCase();
  if (st === 'ocupado') return 'ocupado';
  if (st === 'inhabilitado') return 'inhabilitado';
  return 'libre';
}

/** Construye visualmente el grid 2+2 (bus). */
function buildGrid(targetId, options) {
  options = options || {};
  const hideMissing = typeof options.hideMissing === 'undefined' ? true : !!options.hideMissing;
  const grid = document.getElementById(targetId || 'grid-select');
  if (!grid) return;

  grid.innerHTML = '';
  grid.removeAttribute('aria-busy');
  syncSelectedCounter();

  const rows = getRowsToRender();
  if (!rows.length) {
    grid.innerHTML = '<p class="empty">No hay asientos cargados.</p>';
    return;
  }

  AppState.numLabels = new Map();
  let seatNumber = 1;

  rows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    const left = document.createElement('div'); left.className = 'block';
    const right = document.createElement('div'); right.className = 'block';

    function renderSeat(letter, container) {
      const code = row + letter;
      const state = getSeatState(code);
      const isNum = (state === 'libre' || state === 'ocupado');
      const norm = normalize(code);

      if (isNum) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'seat ' + state;
        btn.textContent = seatNumber;
        btn.setAttribute('data-code', code);
        btn.setAttribute('aria-label', `Asiento ${code} (${seatNumber}) ${state}`);
        AppState.numLabels.set(norm, seatNumber);
        seatNumber++;

        if (targetId === 'grid-select') {
          if (state === 'libre') btn.onclick = () => toggleSeat(code, btn);
          else btn.disabled = true;
        } else {
          btn.disabled = true;
        }
        if (AppState.highlightCodes.has(norm)) btn.classList.add('mine');
        container.appendChild(btn);
        return;
      }

      if (state === 'inhabilitado') {
        const btn2 = document.createElement('button');
        btn2.type = 'button';
        btn2.className = 'seat inhabilitado';
        btn2.disabled = true;
        btn2.setAttribute('aria-label', `Asiento ${code} inhabilitado`);
        container.appendChild(btn2);
        return;
      }

      if (state === 'inexistente' && hideMissing) {
        const ph = document.createElement('div');
        ph.className = 'seat-placeholder';
        ph.setAttribute('aria-hidden', 'true');
        container.appendChild(ph);
        return;
      }

      const btn3 = document.createElement('button');
      btn3.type = 'button';
      btn3.className = 'seat inexistente';
      btn3.disabled = true;
      container.appendChild(btn3);
    }

    ['A', 'B'].forEach(l => renderSeat(l, left));
    const aisle = document.createElement('div');
    aisle.className = 'aisle';
    ['C', 'D'].forEach(l => renderSeat(l, right));

    rowEl.appendChild(left);
    rowEl.appendChild(aisle);
    rowEl.appendChild(right);
    grid.appendChild(rowEl);
  });

  if (AppState.highlightCodes.size) {
    const first = grid.querySelector('.seat.mine');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function toggleSeat(code, el) {
  if (AppState.gridLoading) return;
  const key = normalize(code);
  if (AppState.selected.has(key)) {
    AppState.selected.delete(key);
    el.classList.remove('seleccionado');
  } else {
    AppState.selected.add(key);
    el.classList.add('seleccionado');
  }
  syncSelectedCounter();
}

async function refreshSelectGrid() {
  await refreshSeatsWithSpinner('grid-select', { hideMissing: true });
}

/**
 * Suscribe la planta activa a cambios en tiempo real.
 * Si otro pasajero reserva un asiento mientras estás mirando el croquis,
 * se refleja automáticamente (y se libera de tu selección si la tenías).
 */
function subscribeSeatsRealtime() {
  unsubscribeRealtime();
  if (!AppState.planta) return;

  AppState.realtimeChannel = Api.subscribeToPlanta(AppState.planta.id, (payload) => {
    const row = payload.new || payload.old;
    if (!row) return;
    const norm = normalize(row.code);

    if (payload.eventType === 'DELETE') {
      AppState.seatsByCode.delete(norm);
    } else {
      AppState.seatsByCode.set(norm, {
        id: row.id, estado: row.estado, pasajero: row.pasajero || '', ci: row.ci || ''
      });
      // Si alguien más tomó un asiento que yo tenía seleccionado, lo suelto
      if (row.estado === 'ocupado' && AppState.selected.has(norm)) {
        AppState.selected.delete(norm);
        toast(`El asiento ${AppState.numLabels.get(norm) || norm} ya fue reservado por otra persona`);
      }
    }

    // Re-renderizar el grid visible actualmente (croquis público)
    const visibleGridId = document.getElementById('grid-select') && document.getElementById('view-select').classList.contains('active')
      ? 'grid-select'
      : null;

    if (visibleGridId) buildGrid(visibleGridId, { hideMissing: true });
  });
}

window.refreshSeats = refreshSeats;
window.refreshSeatsWithSpinner = refreshSeatsWithSpinner;
window.refreshSelectGrid = refreshSelectGrid;
window.buildGrid = buildGrid;
window.toggleSeat = toggleSeat;
window.getSeatState = getSeatState;
window.getRowsToRender = getRowsToRender;
window.subscribeSeatsRealtime = subscribeSeatsRealtime;
