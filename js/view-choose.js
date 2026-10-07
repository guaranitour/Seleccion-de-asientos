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
  _loadReservasWhatsapp();
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
          <h3>Todavía no hay selección de asientos habilitada</h3>
          <p>Te avisamos cuando se habilite la de tu viaje.</p>
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

/** Link "Escribinos por WhatsApp" del pie: solo si hay número cargado en el panel. */
async function _loadReservasWhatsapp() {
  const link = document.getElementById('rvWhatsapp');
  if (!link) return;
  try {
    const num = String(await Api.getWhatsappReservas()).replace(/\D/g, '');
    link.hidden = !num;
    if (num) link.href = 'https://wa.me/' + num + '?text=' + encodeURIComponent('Hola! No encuentro mi viaje en la selección de asientos.');
  } catch (e) {
    link.hidden = true;
  }
}

// "Sáb 24/10/2026" y "22:00"
function _rvFecha(iso) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString('es-PY', { weekday: 'short' }).replace('.', '');
  const fecha = d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return dia.charAt(0).toUpperCase() + dia.slice(1) + ' ' + fecha;
}
function _rvHora(iso) {
  return new Date(iso).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function _rvEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

const _RV_ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>';
const _RV_ICON_HORA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

/**
 * Tarjeta de viaje: foto del destino (o fondo de marca), tipo de bus y
 * cuenta regresiva sobre la foto; nombre completo, fecha y hora de salida,
 * y un botón explícito para elegir asiento.
 */
function _buildTripCard(viaje) {
  const isDouble = viaje.tipo === 'doble_piso';
  const card = _rvEl('article', 'rv-trip');

  // ── Foto ──
  const photo = _rvEl('div', 'rv-photo' + (isDouble ? ' doble' : ''));
  const foto = viaje.destino && viaje.destino.imagen_url;
  if (foto) {
    photo.classList.add('has-img');
    photo.style.backgroundImage = `url("${encodeURI(foto)}")`;
  }
  const type = _rvEl('span', 'rv-type' + (isDouble ? ' doble' : ''));
  type.innerHTML = isDouble ? _doubleBusSvg() : _busSvg();
  type.appendChild(document.createTextNode(isDouble ? 'Doble piso' : 'Convencional'));
  photo.appendChild(type);
  if (viaje.start_at) {
    const info = getCountdownText(viaje.start_at);
    if (info) {
      const cd = _rvEl('span', 'rv-countdown', info.text);
      cd.dataset.countdown = '';
      cd.dataset.startAt = viaje.start_at;
      photo.appendChild(cd);
    }
  }
  card.appendChild(photo);

  // ── Cuerpo ──
  const body = _rvEl('div', 'rv-body');
  body.appendChild(_rvEl('h3', '', viaje.nombre));
  if (viaje.start_at) {
    const meta = _rvEl('div', 'rv-meta');
    const f = _rvEl('span'); f.innerHTML = _RV_ICON_CAL; f.appendChild(document.createTextNode(_rvFecha(viaje.start_at)));
    const h = _rvEl('span'); h.innerHTML = _RV_ICON_HORA; h.appendChild(document.createTextNode('Salida ' + _rvHora(viaje.start_at) + ' hs'));
    meta.appendChild(f); meta.appendChild(h);
    body.appendChild(meta);
  }

  const abrir = () => selectViaje(viaje).catch(err => { console.error(err); toast('No se pudo abrir el viaje'); });
  const cta = _rvEl('button', 'rv-cta', isDouble ? 'Elegir planta y asiento' : 'Elegir asiento');
  cta.type = 'button';
  cta.insertAdjacentHTML('beforeend', _arrowSvg());
  cta.onclick = abrir;
  body.appendChild(cta);

  if (isDouble && Array.isArray(viaje.plantas) && viaje.plantas.length > 1) {
    const plantas = viaje.plantas.map(p => /alta/i.test(p.etiqueta) ? p.etiqueta + ' con vista panorámica' : p.etiqueta);
    body.appendChild(_rvEl('p', 'rv-hint', plantas.join(' · ')));
  }
  card.appendChild(body);

  // La foto también abre el viaje (el botón es el acceso con teclado).
  photo.onclick = abrir;
  return card;
}

function backToChoose() {
  resetViajeState();
  showView('view-choose');
  setHash(['Reservas']);
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
    setHash(['Reservas']);
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
/** Navega a la view de Bases y condiciones (accesible desde el menú). */
function goBases() {
  showView('view-bases');
  setHash(['Bases y condiciones']);
  goBasesLanding();
  if (typeof _resetBasesForm === 'function') _resetBasesForm();
}

window.backToChoose = backToChoose;
window.selectViaje = selectViaje;
window.goBases = goBases;
window.chooseFloor = chooseFloor;
window.goTripMenu = goTripMenu;
window.closeFloorSheet = _closeFloorSheet;
