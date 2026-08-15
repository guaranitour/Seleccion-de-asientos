// ============================================================
// router.js — Router por History API (/Reservas, /ViajeX, etc.)
// ============================================================

let ROUTER_DRIVING = false;
let VIAJES_CACHE = [];
let LAST_PROGRAMMATIC_PATH = null;

// Codifica un segmento de ruta escapando solo lo que rompería la URL
// (/, ?, #, %) para que quede legible: sin %20 en vez de espacios ni
// %C3%B3 en vez de tildes/ñ. Los navegadores muestran Unicode y espacios
// directamente en la barra de direcciones sin problema.
function encodePathSegment(s) {
  return String(s || '')
    .replace(/%/g, '%25')
    .replace(/\//g, '%2F')
    .replace(/\?/g, '%3F')
    .replace(/#/g, '%23');
}

function buildPath(segments) {
  return '/' + (segments || []).map(s => encodePathSegment(s)).join('/');
}

function setHash(segments) {
  if (ROUTER_DRIVING) return;
  const next = buildPath(segments);
  if (next === location.pathname) return;
  // Recordamos que este cambio de ruta lo iniciamos nosotros (no el usuario
  // tocando atrás/adelante del navegador). El listener de popstate en
  // main.js compara contra esto y evita volver a llamar a routeTo() para
  // este mismo cambio — sin eso, cambiar la URL dispara una segunda
  // navegación en paralelo (por eso el bottom-sheet de planta a veces no
  // se cerraba: dos renders pisándose el loading).
  LAST_PROGRAMMATIC_PATH = next;
  history.pushState(null, '', next + location.search);
}

/** Usado por el listener de popstate en main.js para decidir si este
 *  cambio de ruta ya fue iniciado (y por lo tanto ya está siendo manejado)
 *  por quien llamó a setHash(). */
function isProgrammaticHashChange() {
  if (LAST_PROGRAMMATIC_PATH !== null && LAST_PROGRAMMATIC_PATH === location.pathname) {
    LAST_PROGRAMMATIC_PATH = null;
    return true;
  }
  return false;
}

function getHashSegments(p) {
  const raw = String(p || location.pathname || '').replace(/^\/+/, '');
  if (!raw) return [];
  return raw.split('/').map(s => {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  });
}

async function ensureViajesCache() {
  if (VIAJES_CACHE.length) return VIAJES_CACHE;
  try {
    VIAJES_CACHE = await Api.getViajes();
  } catch (e) {
    VIAJES_CACHE = [];
  }
  return VIAJES_CACHE;
}

async function resolveViajeByName(name) {
  const viajes = await ensureViajesCache();
  const target = (name || '').trim().toLowerCase();
  return viajes.find(v => (v.nombre || '').trim().toLowerCase() === target) || null;
}

function getFloorLabelFromEtiqueta(etiqueta) {
  const s = String(etiqueta || '').toLowerCase();
  if (s.indexOf('alta') >= 0) return 'Planta alta';
  if (s.indexOf('baja') >= 0) return 'Planta baja';
  return etiqueta;
}

function getPlantaFromFloorLabel(viaje, floorLabel) {
  if (!viaje || !Array.isArray(viaje.plantas)) return null;
  const lbl = String(floorLabel || '').toLowerCase();
  if (lbl.indexOf('alta') >= 0) {
    return viaje.plantas.find(p => p.etiqueta.toLowerCase().indexOf('alta') >= 0) || null;
  }
  if (lbl.indexOf('baja') >= 0) {
    return viaje.plantas.find(p => p.etiqueta.toLowerCase().indexOf('baja') >= 0) || null;
  }
  return viaje.plantas[0] || null;
}

async function routeTo(path) {
  const segs = getHashSegments(path);
  if (!segs.length) {
    setHash(['Reservas']);
    showView('view-choose');
    await loadViajes();
    return;
  }

  const head = (segs[0] || '').trim();
  ROUTER_DRIVING = true;

  try {
    if (head.toLowerCase() === 'reservas' || head.toLowerCase() === 'inicio') {
      if (typeof closeFloorSheet === 'function') closeFloorSheet();
      showView('view-choose');
      await loadViajes();
      return;
    }

    if (head.toLowerCase() === 'seleccion-de-asientos' || head.toLowerCase() === 'selección de asientos') {
      const nombreViaje = segs[1];
      const viaje = await resolveViajeByName(nombreViaje);
      if (!viaje) { toast(`No se encontró el viaje "${nombreViaje}".`); backToChoose(); return; }

      const targetFloor = segs[2] || null;
      const hasFloors = Array.isArray(viaje.plantas) && viaje.plantas.length > 1;

      if (hasFloors && targetFloor) {
        const planta = getPlantaFromFloorLabel(viaje, targetFloor);
        resetViajeState();
        AppState.viaje = viaje;
        updateTripTags();
        if (planta) { await chooseFloor(planta); return; }
      }

      await selectViaje(viaje);
      return;
    }

    if (head.toLowerCase() === 'formulario') {
      const nombreViaje = segs[1];
      const viaje = await resolveViajeByName(nombreViaje);
      if (!viaje) { toast(`No se encontró el viaje "${nombreViaje}".`); backToChoose(); return; }

      if (!AppState.selected || AppState.selected.size === 0) {
        toast('Primero debés seleccionar tus asientos');
        await selectViaje(viaje);
        return;
      }

      AppState.viaje = viaje;
      updateTripTags();
      showView('view-reserve');
      renderReservePage();
      return;
    }

    if (head.toLowerCase() === 'panel') {
      if (!Auth.isAuthorized()) { goStaffLogin(); return; }
      const sub = (segs[1] || '').toLowerCase();
      if (sub === 'control' && segs[2]) {
        const viajes = await ApiAdmin.getAllViajes();
        const viaje = viajes.find(v => v.nombre === segs[2]);
        if (viaje) { await goControl(viaje); return; }
      }
      if (sub === 'editor' && segs[2]) {
        const viajes = await ApiAdmin.getAllViajes();
        const viaje = viajes.find(v => v.nombre === segs[2]);
        if (viaje) { await goEditor(viaje); return; }
      }
      if (sub === 'lista' && segs[2]) {
        const viajes = await ApiAdmin.getAllViajes();
        const viaje = viajes.find(v => v.nombre === segs[2]);
        if (viaje) { await goPassengerList(viaje); return; }
      }
      await goPanel();
      return;
    }

    // Nombre de viaje "plano" — solo puede llegar aquí por una entrada de
    // historial vieja (de antes de esta corrección) o un enlace directo.
    // No es una vista real de la app: la intención siempre es volver a
    // Reservas, así que redirigimos ahí en lugar de reabrir el croquis
    // (que además reabriría el selector de planta y taparía la pantalla).
    setHash(['Reservas']);
    if (typeof closeFloorSheet === 'function') closeFloorSheet();
    showView('view-choose');
    await loadViajes();

  } finally {
    ROUTER_DRIVING = false;
  }
}

window.setHash = setHash;
window.isProgrammaticHashChange = isProgrammaticHashChange;
window.routeTo = routeTo;
window.ensureViajesCache = ensureViajesCache;
window.resolveViajeByName = resolveViajeByName;
window.getFloorLabelFromEtiqueta = getFloorLabelFromEtiqueta;
window.getPlantaFromFloorLabel = getPlantaFromFloorLabel;
