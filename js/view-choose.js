// ============================================================
// view-choose.js — Elegir viaje (pantalla inicial)
// ============================================================

function _busSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18"/><path d="M8 6V4M16 6V4"/>
    <circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/><path d="M3 15h2M19 15h2"/>
  </svg>`;
}

function _doubleBusSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18M3 8h18"/>
    <circle cx="7.5" cy="21" r="1.5"/><circle cx="16.5" cy="21" r="1.5"/>
  </svg>`;
}

function _arrowSvg() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>`;
}

function _searchSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
  </svg>`;
}

async function loadViajes() {
  showLoading('Cargando viajes…');
  try {
    const viajes = await Api.getViajes();
    VIAJES_CACHE = viajes;

    const list = document.getElementById('tripList');
    if (!list) return;
    list.innerHTML = '';

    if (!viajes.length) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No hay viajes disponibles en este momento</h3>
          <p>Nos estaremos viendo próximamente en nuevos destinos 🌍</p>
        </div>`;
      return;
    }

    viajes.forEach(v => list.appendChild(_buildTripCard(v)));
  } catch (err) {
    alert('ERROR DEBUG: ' + (err && err.message ? err.message : JSON.stringify(err)));
    toast('No se pudieron cargar los viajes');
  } finally {
    hideLoading();
  }
}

function _buildTripCard(viaje) {
  const isDouble = viaje.tipo === 'doble_piso';

  const card = document.createElement('div');
  card.className = 'trip-card ' + (isDouble ? 'double-floor' : 'single-floor');
  card.tabIndex = 0;

  const head = document.createElement('div');
  head.className = 'trip-head';

  const headLeft = document.createElement('div');
  headLeft.className = 'trip-head-left';

  const iconEl = document.createElement('div');
  iconEl.className = 'trip-bus-icon' + (isDouble ? ' floors-icon' : '');
  iconEl.innerHTML = isDouble ? _doubleBusSvg() : _busSvg();

  const nameWrap = document.createElement('div');
  nameWrap.style.cssText = 'min-width:0;flex:1';
  const nameEl = document.createElement('h3');
  nameEl.textContent = viaje.nombre;
  nameWrap.appendChild(nameEl);

  headLeft.appendChild(iconEl);
  headLeft.appendChild(nameWrap);

  const pillEl = document.createElement('span');
  pillEl.className = 'trip-pill' + (isDouble ? ' doble' : '');
  pillEl.textContent = isDouble ? 'Doble piso' : 'Convencional';

  const arrowEl = document.createElement('div');
  arrowEl.className = 'trip-arrow';
  arrowEl.innerHTML = _arrowSvg();

  head.appendChild(headLeft);
  head.appendChild(pillEl);
  head.appendChild(arrowEl);
  card.appendChild(head);

  if (viaje.start_at) {
    const info = getCountdownText(viaje.start_at);
    if (info) {
      const cdWrap = document.createElement('div');
      cdWrap.className = 'trip-countdown-wrap';
      const cd = document.createElement('div');
      cd.className = 'trip-countdown ' + info.status;
      cd.textContent = info.text;
      cd.dataset.startAt = viaje.start_at;
      cdWrap.appendChild(cd);
      card.appendChild(cdWrap);
    }
  }

  card.onclick = () => selectViaje(viaje);
  card.onkeypress = (ev) => { if (ev.key === 'Enter') selectViaje(viaje); };

  return card;
}

function backToChoose() {
  resetViajeState();
  showView('view-choose');
  setHash(['Inicio']);
}

/** Selecciona un viaje: decide si va a elegir planta o directo al menú convencional. */
async function selectViaje(viaje) {
  resetViajeState();
  AppState.viaje = viaje;

  const hasFloors = Array.isArray(viaje.plantas) && viaje.plantas.length > 1;

  if (hasFloors) {
    _renderFloorCards(viaje);
    updateTripTags();
    showView('view-floor');
    setHash([viaje.nombre]);
  } else {
    AppState.planta = viaje.plantas[0] || null;
    updateTripTags();
    showView('view-home');
    setHash([viaje.nombre]);
  }
}

function _renderFloorCards(viaje) {
  const box = document.getElementById('floorCards');
  if (!box) return;
  box.innerHTML = '';
  box.className = 'action-cards';

  const icons = {
    baja: { svg: _busSvg(), cls: 'select-icon' },
    alta: { svg: _doubleBusSvg(), cls: 'floor-alta-icon' },
    find: { svg: _searchSvg(), cls: 'find-icon' }
  };

  viaje.plantas.forEach((planta, i) => {
    const key = planta.etiqueta.toLowerCase().indexOf('alta') >= 0 ? 'alta' : 'baja';
    const card = document.createElement('article');
    card.className = 'action-card';
    card.style.animationDelay = (0.06 + i * 0.1) + 's';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="action-card-icon ${icons[key].cls}">${icons[key].svg}</div>
      <div class="action-card-body">
        <div class="action-card-title">${planta.etiqueta}</div>
        <div class="action-card-desc">${key === 'alta' ? 'Mayor altura y vista panorámica.' : 'Acceso rápido, usualmente cerca del conductor.'}</div>
      </div>
      <div class="action-card-arrow">${_arrowSvg()}</div>`;
    card.onclick = () => chooseFloor(planta);
    card.onkeypress = (ev) => { if (ev.key === 'Enter') chooseFloor(planta); };
    box.appendChild(card);
  });

  const findCard = document.createElement('article');
  findCard.className = 'action-card';
  findCard.style.animationDelay = (0.06 + viaje.plantas.length * 0.1) + 's';
  findCard.setAttribute('role', 'button');
  findCard.tabIndex = 0;
  findCard.innerHTML = `
    <div class="action-card-icon find-icon">${icons.find.svg}</div>
    <div class="action-card-body">
      <div class="action-card-title">Ver mi asiento</div>
      <div class="action-card-desc">Ingresá tu documento para encontrar tu número y ubicación.</div>
    </div>
    <div class="action-card-arrow">${_arrowSvg()}</div>`;
  findCard.onclick = () => goFind();
  findCard.onkeypress = (ev) => { if (ev.key === 'Enter') goFind(); };
  box.appendChild(findCard);
}

async function chooseFloor(planta) {
  AppState.planta = planta;
  updateTripTags();
  showView('view-home');
  setHash(['Selección de asientos', AppState.viaje.nombre, getFloorLabelFromEtiqueta(planta.etiqueta)]);
}

function goTripMenu() {
  if (!AppState.viaje) { setHash(['Inicio']); showView('view-choose'); return; }
  const hasFloors = Array.isArray(AppState.viaje.plantas) && AppState.viaje.plantas.length > 1;
  if (hasFloors && !AppState.planta) {
    _renderFloorCards(AppState.viaje);
    updateTripTags();
    showView('view-floor');
  } else {
    updateTripTags();
    showView('view-home');
  }
  setHash([AppState.viaje.nombre]);
}

function goHome() {
  if (!AppState.viaje || !AppState.planta) { setHash(['Inicio']); showView('view-choose'); return; }
  updateTripTags();
  showView('view-home');
  setHash([AppState.viaje.nombre]);
}

window.loadViajes = loadViajes;
window.backToChoose = backToChoose;
window.selectViaje = selectViaje;
window.chooseFloor = chooseFloor;
window.goTripMenu = goTripMenu;
window.goHome = goHome;
