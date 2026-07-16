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
          <div class="empty-state-icon" aria-hidden="true">${_busSvg()}</div>
          <h3>No hay viajes disponibles en este momento</h3>
          <p>Nos estaremos viendo próximamente en nuevos destinos 🌍</p>
        </div>`;
      return;
    }

    viajes.forEach(v => list.appendChild(_buildTripCard(v)));
  } catch (err) {
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

  const pillEl = document.createElement('span');
  pillEl.className = 'trip-pill' + (isDouble ? ' doble' : '');
  pillEl.textContent = isDouble ? 'Doble piso' : 'Convencional';
  nameWrap.appendChild(pillEl);

  headLeft.appendChild(iconEl);
  headLeft.appendChild(nameWrap);

  const arrowEl = document.createElement('div');
  arrowEl.className = 'trip-arrow';
  arrowEl.innerHTML = _arrowSvg();

  head.appendChild(headLeft);
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

  card.onclick = () => selectViaje(viaje).catch(err => { console.error(err); toast('No se pudo abrir el viaje'); });
  card.onkeypress = (ev) => { if (ev.key === 'Enter') selectViaje(viaje).catch(err => { console.error(err); toast('No se pudo abrir el viaje'); }); };

  return card;
}

function backToChoose() {
  resetViajeState();
  showView('view-choose');
  setHash(['Inicio']);
  loadViajes().catch(err => console.error(err));
}

/** Tap en una card de viaje: convencional va directo al croquis,
 *  doble piso abre un bottom-sheet para elegir planta. */
async function selectViaje(viaje) {
  resetViajeState();
  AppState.viaje = viaje;
  updateTripTags();

  const hasFloors = Array.isArray(viaje.plantas) && viaje.plantas.length > 1;

  if (hasFloors) {
    _openFloorSheet(viaje);
  } else {
    AppState.planta = viaje.plantas[0] || null;
    await goSelect();
  }
}

function _openFloorSheet(viaje) {
  const sheet = document.getElementById('floorSheet');
  const box = document.getElementById('floorSheetOptions');
  if (!sheet || !box) return;

  box.innerHTML = '';
  const icons = {
    baja: { svg: _busSvg(), cls: 'select-icon' },
    alta: { svg: _doubleBusSvg(), cls: 'floor-alta-icon' }
  };

  viaje.plantas.forEach(planta => {
    const key = planta.etiqueta.toLowerCase().indexOf('alta') >= 0 ? 'alta' : 'baja';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'floor-sheet-option';
    btn.innerHTML = `
      <div class="action-card-icon ${icons[key].cls}">${icons[key].svg}</div>
      <div class="action-card-body">
        <div class="action-card-title">${planta.etiqueta}</div>
        <div class="action-card-desc">${key === 'alta' ? 'Mayor altura y vista panorámica.' : 'Acceso rápido, usualmente cerca del conductor.'}</div>
      </div>
      <div class="action-card-arrow">${_arrowSvg()}</div>`;
    btn.onclick = () => { _closeFloorSheet(); chooseFloor(planta); };
    box.appendChild(btn);
  });

  document.getElementById('floorSheetTripName').textContent = viaje.nombre;
  sheet.classList.add('show');

  // Cerrar al tocar el fondo oscuro (fuera del contenido del sheet)
  sheet.onclick = (ev) => {
    if (ev.target === sheet) _closeFloorSheet();
  };
}

function _closeFloorSheet() {
  const sheet = document.getElementById('floorSheet');
  if (sheet) sheet.classList.remove('show');
}

async function chooseFloor(planta) {
  AppState.planta = planta;
  await goSelect();
}

/** Vuelve a la selección de planta (doble piso) o al croquis (convencional). */
function goTripMenu() {
  if (!AppState.viaje) {
    setHash(['Inicio']);
    showView('view-choose');
    loadViajes().catch(err => console.error(err));
    return;
  }
  const hasFloors = Array.isArray(AppState.viaje.plantas) && AppState.viaje.plantas.length > 1;
  if (hasFloors) {
    AppState.planta = null;
    showView('view-choose');
    setHash([AppState.viaje.nombre]);
    _openFloorSheet(AppState.viaje);
  } else {
    backToChoose();
  }
}

window.loadViajes = loadViajes;
window.backToChoose = backToChoose;
window.selectViaje = selectViaje;
window.chooseFloor = chooseFloor;
window.goTripMenu = goTripMenu;
window.closeFloorSheet = _closeFloorSheet;
