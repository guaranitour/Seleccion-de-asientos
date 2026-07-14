// ============================================================
// view-editor.js — Editor de estructura de asientos (solo admin)
// Agregar/eliminar filas, habilitar/inhabilitar asientos.
// ============================================================

const EditorState = {
  viaje: null,
  planta: null
};

async function goEditor(viaje) {
  if (!Auth.isAdmin()) { toast('Solo administradores pueden editar la estructura'); return; }

  EditorState.viaje = viaje;
  EditorState.planta = viaje.plantas[0] || null;

  showView('view-editor');
  document.getElementById('editorTripName').textContent = viaje.nombre;

  _renderEditorPlantaTabs();
  await refreshEditorGrid();
  setHash(['Panel', 'Editor', viaje.nombre]);
}

function _renderEditorPlantaTabs() {
  const tabs = document.getElementById('editorPlantaTabs');
  tabs.innerHTML = '';
  if (EditorState.viaje.plantas.length <= 1) { tabs.style.display = 'none'; return; }

  tabs.style.display = '';
  EditorState.viaje.plantas.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'btn ghost' + (p.id === EditorState.planta.id ? ' active-tab' : '');
    btn.textContent = p.etiqueta;
    btn.onclick = async () => {
      EditorState.planta = p;
      _renderEditorPlantaTabs();
      await refreshEditorGrid();
    };
    tabs.appendChild(btn);
  });
}

async function refreshEditorGrid() {
  showLoading('Cargando estructura…');
  try {
    const rows = await ApiAdmin.getAsientosByPlanta(EditorState.planta.id);
    _renderEditorGrid(rows);
  } catch (e) {
    toast('Error al cargar estructura');
  } finally {
    hideLoading();
  }
}

function _renderEditorGrid(seats) {
  const grid = document.getElementById('grid-editor');
  grid.innerHTML = '';

  const rowsMap = new Map();
  seats.forEach(s => {
    if (!rowsMap.has(s.fila)) rowsMap.set(s.fila, []);
    rowsMap.get(s.fila).push(s);
  });

  const filas = Array.from(rowsMap.keys()).sort((a, b) => a - b);

  filas.forEach(fila => {
    const rowWrap = document.createElement('div');
    rowWrap.className = 'editor-row-wrap';

    const rowLabel = document.createElement('div');
    rowLabel.className = 'editor-row-label';
    rowLabel.textContent = 'Fila ' + fila;

    const rowEl = document.createElement('div');
    rowEl.className = 'row';
    const left = document.createElement('div'); left.className = 'block';
    const right = document.createElement('div'); right.className = 'block';

    const seatsInRow = rowsMap.get(fila).sort((a, b) => a.letra.localeCompare(b.letra));
    const hasOcupado = seatsInRow.some(s => s.estado === 'ocupado');

    ['A', 'B', 'C', 'D'].forEach(letra => {
      const seat = seatsInRow.find(s => s.letra === letra);
      const container = (letra === 'A' || letra === 'B') ? left : right;
      if (!seat) { const ph = document.createElement('div'); ph.className = 'seat-placeholder'; container.appendChild(ph); return; }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'seat ' + (seat.estado === 'inhabilitado' ? 'inhabilitado' : seat.estado);
      btn.textContent = letra;
      if (seat.estado === 'ocupado') {
        btn.disabled = true;
        btn.title = 'Ocupado — no se puede editar hasta liberar';
      } else {
        btn.onclick = () => _toggleAsientoHabilitado(seat);
      }
      container.appendChild(btn);
    });

    rowEl.appendChild(left);
    const aisle = document.createElement('div'); aisle.className = 'aisle';
    rowEl.appendChild(aisle);
    rowEl.appendChild(right);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn ghost editor-row-delete';
    delBtn.textContent = '🗑';
    delBtn.disabled = hasOcupado;
    delBtn.title = hasOcupado ? 'No se puede eliminar: hay asientos ocupados' : 'Eliminar fila';
    delBtn.onclick = () => _confirmEliminarFila(fila);

    rowWrap.appendChild(rowLabel);
    rowWrap.appendChild(rowEl);
    rowWrap.appendChild(delBtn);
    grid.appendChild(rowWrap);
  });

  const maxFila = filas.length ? Math.max(...filas) : 0;
  document.getElementById('editorNextRowNum').textContent = maxFila + 1;
}

async function _toggleAsientoHabilitado(seat) {
  const nuevoHabilitado = seat.estado === 'inhabilitado';
  showLoading(nuevoHabilitado ? 'Habilitando…' : 'Inhabilitando…');
  try {
    await ApiAdmin.setAsientoHabilitado(seat.id, nuevoHabilitado);
    await refreshEditorGrid();
  } catch (e) {
    toast('Error: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

async function addEditorRow() {
  const nextRow = parseInt(document.getElementById('editorNextRowNum').textContent, 10);
  showLoading('Agregando fila…');
  try {
    await ApiAdmin.agregarFila(EditorState.planta.id, nextRow);
    await refreshEditorGrid();
    toast('Fila ' + nextRow + ' agregada');
  } catch (e) {
    toast('Error: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

function _confirmEliminarFila(fila) {
  if (!confirm(`¿Eliminar la fila ${fila} completa? Esta acción no se puede deshacer.`)) return;
  _eliminarFila(fila);
}

async function _eliminarFila(fila) {
  showLoading('Eliminando fila…');
  try {
    await ApiAdmin.eliminarFila(EditorState.planta.id, fila);
    await refreshEditorGrid();
    toast('Fila eliminada');
  } catch (e) {
    toast('Error: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

window.goEditor = goEditor;
window.refreshEditorGrid = refreshEditorGrid;
window.addEditorRow = addEditorRow;
