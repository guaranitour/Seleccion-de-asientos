// ============================================================
// view-panel.js — Panel principal staff/admin: lista de viajes
// ============================================================

let _panelViajesCache = [];
let _panelShowArchived = false;

// Cada viaje tiene dos interruptores independientes:
//   publicado_inicio → aparece en "Próximos viajes" del inicio
//   activo           → selección de asientos habilitada (lista de Reservas + croquis)
// Archivado = los dos apagados.
function _viajeVisible(v) {
  return !!(v.activo || v.publicado_inicio);
}

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

  const activos = _panelViajesCache.filter(_viajeVisible);
  const archivados = _panelViajesCache.filter(v => !_viajeVisible(v));

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
        <p>Todos los viajes están archivados (sin publicar y con la selección cerrada). Tocá "Ver archivados" para verlos.</p>
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

  const publicados = viajes.filter(v => v.publicado_inicio).length;
  const seleccion = viajes.filter(v => v.activo).length;

  box.innerHTML = `
    <div class="panel-stat accent">
      <span class="panel-stat-value">${publicados}</span>
      <span class="panel-stat-label">Publicados en inicio</span>
    </div>
    <div class="panel-stat">
      <span class="panel-stat-value">${seleccion}</span>
      <span class="panel-stat-label">Selección abierta</span>
    </div>
    <div class="panel-stat">
      <span class="panel-stat-value">${viajes.length}</span>
      <span class="panel-stat-label">Total viajes</span>
    </div>`;
}

function _buildPanelTripCard(viaje) {
  const card = document.createElement('div');
  const esDoble = viaje.tipo === 'doble_piso';
  const visible = _viajeVisible(viaje);
  card.className = 'panel-trip-card' + (esDoble ? ' doble-piso' : '') + (visible ? '' : ' inactive');

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
      <span class="panel-trip-status ${visible ? 'active' : 'inactive'}">${visible ? 'Activo' : 'Archivado'}</span>
    </div>
    <div class="panel-trip-visibility"></div>
    <div class="panel-trip-actions"></div>`;

  // Interruptores de visibilidad. Solo el admin los cambia; el staff los ve.
  const vis = card.querySelector('.panel-trip-visibility');
  vis.appendChild(_buildVisSwitch({
    label: 'Publicado en el inicio',
    hint: viaje.publicado_inicio ? 'Se ve en Próximos viajes' : 'No aparece en el inicio',
    on: !!viaje.publicado_inicio,
    onToggle: () => setPanelViajeVisibilidad(viaje.id, { publicadoInicio: !viaje.publicado_inicio })
  }));
  vis.appendChild(_buildVisSwitch({
    label: 'Selección de asientos',
    hint: viaje.activo ? 'Habilitada: se pueden elegir asientos' : 'Cerrada',
    on: !!viaje.activo,
    onToggle: () => setPanelViajeVisibilidad(viaje.id, { seleccionHabilitada: !viaje.activo })
  }));

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
  }

  return card;
}

function _buildVisSwitch({ label, hint, on, onToggle }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'vis-switch' + (on ? ' on' : '');
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', String(on));
  btn.innerHTML = `
    <span class="vis-switch-track" aria-hidden="true"><span class="vis-switch-thumb"></span></span>
    <span class="vis-switch-text"><b></b><small></small></span>`;
  btn.querySelector('b').textContent = label;
  btn.querySelector('small').textContent = hint;
  if (Auth.isAdmin()) {
    btn.onclick = onToggle;
  } else {
    btn.disabled = true;
    btn.title = 'Solo un admin puede cambiarlo';
  }
  return btn;
}

async function setPanelViajeVisibilidad(viajeId, cambios) {
  showLoading('Guardando…');
  try {
    await ApiAdmin.setViajeVisibilidad(viajeId, cambios);
    if (cambios.publicadoInicio !== undefined && cambios.publicadoInicio !== null) {
      toast(cambios.publicadoInicio ? 'Publicado en el inicio' : 'Quitado del inicio');
    } else {
      toast(cambios.seleccionHabilitada ? 'Selección de asientos habilitada' : 'Selección de asientos cerrada');
    }
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
  const publicadoInicio = document.getElementById('newTripPublicado').checked;
  const seleccionHabilitada = document.getElementById('newTripSeleccion').checked;

  if (!nombre) {
    toast('Completá el nombre del viaje');
    return;
  }

  showLoading('Creando viaje…');
  try {
    const viajeId = await ApiAdmin.crearViaje(nombre, tipo, fecha ? new Date(fecha).toISOString() : null);
    // crear_viaje deja la selección habilitada por defecto (columna activo);
    // acá se aplica lo que se eligió en el formulario.
    await ApiAdmin.setViajeVisibilidad(viajeId, { publicadoInicio, seleccionHabilitada });
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
window.setPanelViajeVisibilidad = setPanelViajeVisibilidad;
window.togglePanelArchivedView = togglePanelArchivedView;
window.openCreateTripForm = openCreateTripForm;
window.updateTripRowsHint = updateTripRowsHint;
window.submitCreateTrip = submitCreateTrip;
