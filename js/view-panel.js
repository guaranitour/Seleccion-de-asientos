// ============================================================
// view-panel.js — Panel principal staff/admin: lista de viajes
// ============================================================

let _panelViajesCache = [];
let _panelShowArchived = false;

async function goPanel() {
  if (!Auth.isAuthorized()) { goStaffLogin(); return; }

  showView('view-panel');
  document.getElementById('panelRoleBadge').textContent = Auth.isAdmin() ? 'Admin' : 'Staff';

  const createBtn = document.getElementById('btnCreateTrip');
  if (createBtn) createBtn.style.display = Auth.isAdmin() ? 'inline-flex' : 'none';

  _panelShowArchived = false; // el panel siempre arranca mostrando solo activos
  await loadPanelViajes();
  setHash(['Panel']);
}

async function loadPanelViajes() {
  showLoading('Cargando viajes…');
  try {
    _panelViajesCache = await ApiAdmin.getAllViajes();
    _renderPanelStats(_panelViajesCache);
    _renderPanelTripList();
  } catch (e) {
    console.error(e);
    toast('Error al cargar viajes del panel');
  } finally {
    hideLoading();
  }
}

function togglePanelArchivedView() {
  _panelShowArchived = !_panelShowArchived;
  _renderPanelTripList();
}

function _renderPanelTripList() {
  const list = document.getElementById('panelTripList');
  list.innerHTML = '';

  const activos = _panelViajesCache.filter(v => v.activo);
  const archivados = _panelViajesCache.filter(v => !v.activo);

  _renderArchivedToggle(archivados.length);

  if (!_panelViajesCache.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6M16 6v6M2 12h20M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M2 12V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/></svg>
        </div>
        <h3>No hay viajes cargados</h3>
        <p>Todavía no se creó ningún viaje.</p>
      </div>`;
    return;
  }

  if (!activos.length && !_panelShowArchived) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6M16 6v6M2 12h20M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M2 12V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4"/></svg>
        </div>
        <h3>No hay viajes activos</h3>
        <p>Todos los viajes están archivados. Tocá "Ver archivados" para verlos.</p>
      </div>`;
    return;
  }

  activos.forEach(v => list.appendChild(_buildPanelTripCard(v)));

  if (_panelShowArchived && archivados.length) {
    const sep = document.createElement('div');
    sep.className = 'panel-section-sep';
    sep.innerHTML = `<span>Archivados</span>`;
    list.appendChild(sep);
    archivados.forEach(v => list.appendChild(_buildPanelTripCard(v)));
  }
}

function _renderArchivedToggle(archivedCount) {
  const box = document.getElementById('panelArchivedToggle');
  if (!box) return;

  if (!archivedCount) { box.innerHTML = ''; return; }

  box.innerHTML = `
    <button class="panel-archived-chip ${_panelShowArchived ? 'active' : ''}" onclick="togglePanelArchivedView()" type="button">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
      ${_panelShowArchived ? 'Ocultar archivados' : 'Ver archivados'} (${archivedCount})
    </button>`;
}

function _renderPanelStats(viajes) {
  const box = document.getElementById('panelStats');
  if (!box) return;

  const activos = viajes.filter(v => v.activo).length;
  const dobles = viajes.filter(v => v.tipo === 'doble_piso' && v.activo).length;

  box.innerHTML = `
    <div class="panel-stat accent">
      <span class="panel-stat-value">${activos}</span>
      <span class="panel-stat-label">Viajes activos</span>
    </div>
    <div class="panel-stat">
      <span class="panel-stat-value">${viajes.length}</span>
      <span class="panel-stat-label">Total viajes</span>
    </div>
    <div class="panel-stat">
      <span class="panel-stat-value">${dobles}</span>
      <span class="panel-stat-label">Doble piso activos</span>
    </div>`;
}

function _buildPanelTripCard(viaje) {
  const card = document.createElement('div');
  const esDoble = viaje.tipo === 'doble_piso';
  card.className = 'panel-trip-card' + (esDoble ? ' doble-piso' : '') + (viaje.activo ? '' : ' inactive');

  const plantasLabel = viaje.plantas.map(p => p.etiqueta).join(' / ');
  const fechaLabel = viaje.start_at
    ? new Date(viaje.start_at).toLocaleString('es-PY', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const busIconPaths = esDoble
    ? '<path d="M4 17h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0h1"/><path d="M4 17V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v11"/><path d="M4 11h16"/>'
    : '<path d="M4 17h1a2 2 0 0 0 4 0h6a2 2 0 0 0 4 0h1"/><path d="M18 17H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9l3 5v5a2 2 0 0 1-2 2Z"/>';

  card.innerHTML = `
    <div class="panel-trip-head">
      <div class="panel-trip-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${busIconPaths}</svg>
      </div>
      <div class="panel-trip-info">
        <div class="panel-trip-name">${viaje.nombre}</div>
        <div class="panel-trip-meta">
          <span>${esDoble ? 'Doble piso' : 'Convencional'} — ${plantasLabel}</span>
          ${fechaLabel ? `<span class="dot-sep">${fechaLabel}</span>` : ''}
        </div>
      </div>
      <span class="panel-trip-status ${viaje.activo ? 'active' : 'inactive'}">${viaje.activo ? 'Activo' : 'Archivado'}</span>
    </div>
    <div class="panel-trip-actions"></div>`;

  const actions = card.querySelector('.panel-trip-actions');

  // Acción principal: la más usada día a día, con presencia visual propia.
  const controlBtn = document.createElement('button');
  controlBtn.className = 'btn primary btn-icon btn-primary-action';
  controlBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> Ver ocupación';
  controlBtn.onclick = () => goControl(viaje);
  actions.appendChild(controlBtn);

  const paxBtn = document.createElement('button');
  paxBtn.className = 'btn ghost icon-only';
  paxBtn.title = 'Lista de pasajeros';
  paxBtn.setAttribute('aria-label', 'Lista de pasajeros');
  paxBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  paxBtn.onclick = () => goPassengerList(viaje);
  actions.appendChild(paxBtn);

  if (Auth.isAdmin()) {
    const editBtn = document.createElement('button');
    editBtn.className = 'btn ghost icon-only';
    editBtn.title = 'Editar estructura';
    editBtn.setAttribute('aria-label', 'Editar estructura');
    editBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';
    editBtn.onclick = () => goEditor(viaje);
    actions.appendChild(editBtn);

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn ghost icon-only';
    toggleBtn.title = viaje.activo ? 'Archivar' : 'Reactivar';
    toggleBtn.setAttribute('aria-label', viaje.activo ? 'Archivar' : 'Reactivar');
    toggleBtn.innerHTML = viaje.activo
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
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
window.togglePanelArchivedView = togglePanelArchivedView;
window.openCreateTripForm = openCreateTripForm;
window.updateTripRowsHint = updateTripRowsHint;
window.submitCreateTrip = submitCreateTrip;
