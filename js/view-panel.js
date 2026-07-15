// ============================================================
// view-panel.js — Panel principal staff/admin: lista de viajes
// ============================================================

async function goPanel() {
  if (!Auth.isAuthorized()) { goStaffLogin(); return; }

  showView('view-panel');
  document.getElementById('panelRoleBadge').textContent = Auth.isAdmin() ? 'Admin' : 'Staff';

  const createBtn = document.getElementById('btnCreateTrip');
  if (createBtn) createBtn.style.display = Auth.isAdmin() ? '' : 'none';

  await loadPanelViajes();
  setHash(['Panel']);
}

async function loadPanelViajes() {
  showLoading('Cargando viajes…');
  try {
    const viajes = await ApiAdmin.getAllViajes();
    const list = document.getElementById('panelTripList');
    list.innerHTML = '';

    if (!viajes.length) {
      list.innerHTML = '<div class="empty-state"><p>No hay viajes cargados todavía.</p></div>';
      return;
    }

    viajes.forEach(v => list.appendChild(_buildPanelTripCard(v)));
  } catch (e) {
    console.error(e);
    toast('Error al cargar viajes del panel');
  } finally {
    hideLoading();
  }
}

function _buildPanelTripCard(viaje) {
  const card = document.createElement('div');
  card.className = 'panel-trip-card' + (viaje.activo ? '' : ' inactive');

  const plantasLabel = viaje.plantas.map(p => p.etiqueta).join(' / ');

  card.innerHTML = `
    <div class="panel-trip-head">
      <div>
        <div class="panel-trip-name">${viaje.nombre}</div>
        <div class="panel-trip-meta">${viaje.tipo === 'doble_piso' ? 'Doble piso' : 'Convencional'} — ${plantasLabel}</div>
      </div>
      <span class="panel-trip-status ${viaje.activo ? 'active' : 'inactive'}">${viaje.activo ? 'Activo' : 'Archivado'}</span>
    </div>
    <div class="panel-trip-actions"></div>`;

  const actions = card.querySelector('.panel-trip-actions');

  const controlBtn = document.createElement('button');
  controlBtn.className = 'btn ghost';
  controlBtn.textContent = 'Ver ocupación';
  controlBtn.onclick = () => goControl(viaje);
  actions.appendChild(controlBtn);

  if (Auth.isAdmin()) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn ghost';
    editBtn.textContent = 'Editar estructura';
    editBtn.onclick = () => goEditor(viaje);
    actions.appendChild(editBtn);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn ghost';
    toggleBtn.textContent = viaje.activo ? 'Archivar' : 'Reactivar';
    toggleBtn.onclick = () => togglePanelViaje(viaje.id, !viaje.activo);
    actions.appendChild(toggleBtn);
  }

  return card;
}

async function togglePanelViaje(viajeId, nuevoEstado) {
  showLoading(nuevoEstado ? 'Reactivando…' : 'Archivando…');
  try {
    await ApiAdmin.setViajeActivo(viajeId, nuevoEstado);
    toast(nuevoEstado ? 'Viaje reactivado' : 'Viaje archivado');
    await loadPanelViajes();
  } catch (e) {
    toast('Error: ' + (e.message || 'no se pudo actualizar'));
  } finally {
    hideLoading();
  }
}

// ── Crear viaje ──
function openCreateTripForm() {
  if (!Auth.isAdmin()) return;
  document.getElementById('createTripForm').reset();
  updateTripRowsHint();
  showView('view-create-trip');
}

function updateTripRowsHint() {
  const tipo = document.getElementById('newTripType').value;
  const hint = document.getElementById('tripRowsHint');
  if (!hint) return;
  hint.textContent = tipo === 'doble_piso'
    ? 'Se crearán 10 filas en planta alta (40 asientos) y 5 en planta baja (20 asientos).'
    : 'Se crearán 11 filas (44 asientos).';
}

async function submitCreateTrip(ev) {
  ev.preventDefault();
  const nombre = document.getElementById('newTripName').value.trim();
  const tipo = document.getElementById('newTripType').value;
  const fecha = document.getElementById('newTripDate').value;

  if (!nombre) {
    toast('Completá el nombre del viaje');
    return;
  }

  showLoading('Creando viaje…');
  try {
    await ApiAdmin.crearViaje(nombre, tipo, fecha ? new Date(fecha).toISOString() : null);
    toast('Viaje creado correctamente');
    goPanel();
  } catch (e) {
    toast('Error al crear viaje: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

window.goPanel = goPanel;
window.loadPanelViajes = loadPanelViajes;
window.togglePanelViaje = togglePanelViaje;
window.openCreateTripForm = openCreateTripForm;
window.updateTripRowsHint = updateTripRowsHint;
window.submitCreateTrip = submitCreateTrip;
