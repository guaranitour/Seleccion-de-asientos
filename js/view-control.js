// ============================================================
// view-control.js — Panel de control: mover/liberar pasajeros,
// ver ocupación por planta.
// ============================================================

const ControlState = {
  viaje: null,
  planta: null,
  moveSource: null // code del asiento origen cuando se está moviendo
};

async function goControl(viaje) {
  if (!Auth.isAuthorized()) { goStaffLogin(); return; }

  ControlState.viaje = viaje;
  ControlState.planta = viaje.plantas[0] || null;
  ControlState.moveSource = null;

  showView('view-control');
  document.getElementById('controlTripName').textContent = viaje.nombre;

  _renderPlantaTabs();
  await refreshControlGrid();
  setHash(['Panel', 'Control', viaje.nombre]);
}

function _renderPlantaTabs() {
  const tabs = document.getElementById('controlPlantaTabs');
  tabs.innerHTML = '';
  if (ControlState.viaje.plantas.length <= 1) { tabs.style.display = 'none'; return; }

  tabs.style.display = '';
  ControlState.viaje.plantas.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn ghost' + (p.id === ControlState.planta.id ? ' active-tab' : '');
    btn.textContent = p.etiqueta;
    btn.onclick = async () => {
      ControlState.planta = p;
      ControlState.moveSource = null;
      _renderPlantaTabs();
      await refreshControlGrid();
    };
    tabs.appendChild(btn);
  });
}

async function refreshControlGrid() {
  showLoading('Cargando ocupación…');
  try {
    const rows = await ApiAdmin.getAsientosByPlanta(ControlState.planta.id);
    _renderControlGrid(rows);
  } catch (e) {
    toast('Error al cargar asientos');
  } finally {
    hideLoading();
  }
}

function _renderControlGrid(seats) {
  const grid = document.getElementById('grid-control');
  grid.innerHTML = '';

  const rowsMap = new Map();
  seats.forEach(s => {
    if (!rowsMap.has(s.fila)) rowsMap.set(s.fila, []);
    rowsMap.get(s.fila).push(s);
  });

  const filas = Array.from(rowsMap.keys()).sort((a, b) => a - b);
  let seatNumber = 1;
  const numByCode = new Map();

  filas.forEach(fila => {
    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    const left = document.createElement('div'); left.className = 'block';
    const right = document.createElement('div'); right.className = 'block';

    const seatsInRow = rowsMap.get(fila).sort((a, b) => a.letra.localeCompare(b.letra));

    ['A', 'B', 'C', 'D'].forEach(letra => {
      const seat = seatsInRow.find(s => s.letra === letra);
      const container = (letra === 'A' || letra === 'B') ? left : right;
      if (!seat) { const ph = document.createElement('div'); ph.className = 'seat-placeholder'; container.appendChild(ph); return; }

      const btn = document.createElement('button');
      btn.type = 'button';

      if (seat.estado === 'inhabilitado') {
        btn.className = 'seat inhabilitado';
        btn.disabled = true;
        container.appendChild(btn);
        return;
      }

      numByCode.set(seat.code, seatNumber);
      const isSelected = ControlState.moveSource === seat.code;
      btn.className = 'seat ' + (isSelected ? 'seleccionado' : seat.estado);

      if (seat.estado === 'ocupado' && seat.pasajero) {
        const firstName = seat.pasajero.trim().split(/\s+/)[0];
        btn.innerHTML = `<span class="control-seat-num">${seatNumber}</span><span class="control-seat-name">${firstName}</span>`;
        btn.title = seat.pasajero;
        btn.setAttribute('aria-label', `Asiento ${seatNumber}, ocupado por ${seat.pasajero}`);
      } else {
        btn.textContent = seatNumber;
      }
      seatNumber++;

      btn.onclick = () => _onControlSeatClick(seat);
      container.appendChild(btn);
    });

    rowEl.appendChild(left);
    const aisle = document.createElement('div'); aisle.className = 'aisle';
    rowEl.appendChild(aisle);
    rowEl.appendChild(right);
    grid.appendChild(rowEl);
  });

  _renderMoveBar();
}

function _onControlSeatClick(seat) {
  if (ControlState.moveSource) {
    if (ControlState.moveSource === seat.code) {
      ControlState.moveSource = null; // deseleccionar
      refreshControlGrid();
      return;
    }
    if (seat.estado === 'libre') {
      _confirmMove(ControlState.moveSource, seat.code);
      return;
    }
    toast('El destino debe ser un asiento libre');
    return;
  }

  if (seat.estado === 'ocupado') {
    _openSeatActionSheet(seat);
  } else if (seat.estado === 'libre') {
    toast('Ese asiento está libre');
  }
}

function _openSeatActionSheet(seat) {
  const sheet = document.getElementById('seatActionSheet');
  document.getElementById('sheetSeatCode').textContent = `Asiento ${seat.code}`;
  document.getElementById('sheetSeatPasajero').textContent = seat.pasajero || '(sin nombre)';

  document.getElementById('sheetBtnMove').onclick = () => {
    ControlState.moveSource = seat.code;
    _closeSeatActionSheet();
    refreshControlGrid();
    toast('Elegí el asiento destino');
  };
  document.getElementById('sheetBtnFree').onclick = () => {
    _closeSeatActionSheet();
    _confirmFree(seat.code);
  };
  document.getElementById('sheetBtnCancel').onclick = _closeSeatActionSheet;

  sheet.classList.add('show');
}

function _closeSeatActionSheet() {
  document.getElementById('seatActionSheet').classList.remove('show');
}

async function _confirmMove(sourceCode, targetCode) {
  showLoading('Moviendo pasajero…');
  try {
    await ApiAdmin.moverPasajero(ControlState.planta.id, sourceCode, targetCode);
    toast('Pasajero movido correctamente');
    ControlState.moveSource = null;
    await refreshControlGrid();
  } catch (e) {
    toast('Error: ' + (e.message || 'no se pudo mover'));
    ControlState.moveSource = null;
    await refreshControlGrid();
  } finally {
    hideLoading();
  }
}

async function _confirmFree(code) {
  showLoading('Liberando asiento…');
  try {
    await ApiAdmin.liberarAsiento(ControlState.planta.id, code);
    toast('Asiento liberado');
    await refreshControlGrid();
  } catch (e) {
    toast('Error: ' + (e.message || 'no se pudo liberar'));
  } finally {
    hideLoading();
  }
}

function _renderMoveBar() {
  const bar = document.getElementById('controlMoveBar');
  if (ControlState.moveSource) {
    bar.style.display = '';
    bar.querySelector('.control-move-text').textContent =
      `Moviendo asiento ${ControlState.moveSource} — elegí el destino`;
  } else {
    bar.style.display = 'none';
  }
}

function cancelMove() {
  ControlState.moveSource = null;
  refreshControlGrid();
}

window.goControl = goControl;
window.refreshControlGrid = refreshControlGrid;
window.cancelMove = cancelMove;
