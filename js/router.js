// ============================================================
// router.js — Router por hash (#/Inicio, #/ViajeX, etc.)
// ============================================================

let ROUTER_DRIVING = false;
let VIAJES_CACHE = [];
let LAST_PROGRAMMATIC_HASH = null;

function buildHash(segments) {
  return '#/' + (segments || []).map(s => encodeURIComponent(String(s || ''))).join('/');
}

function setHash(segments) {
  if (ROUTER_DRIVING) return;
  const next = buildHash(segments);
  if (next === location.hash) return;
  // Recordamos que este cambio de hash lo iniciamos nosotros (no el usuario
  // tocando atrás/adelante del navegador). El listener de hashchange en
  // main.js compara contra esto y evita volver a llamar a routeTo() para
  // este mismo cambio — sin eso, cambiar location.hash dispara "hashchange"
  // y se dispara una segunda navegación en paralelo (por eso el bottom-sheet
  // de planta a veces no se cerraba: dos renders pisándose el loading).
  LAST_PROGRAMMATIC_HASH = next;
  location.hash = next;
}

/** Usado por el listener de hashchange en main.js para decidir si este
 *  cambio de hash ya fue iniciado (y por lo tanto ya está siendo manejado)
 *  por quien llamó a setHash(). */
function isProgrammaticHashChange() {
  if (LAST_PROGRAMMATIC_HASH !== null && LAST_PROGRAMMATIC_HASH === location.hash) {
    LAST_PROGRAMMATIC_HASH = null;
    return true;
  }
  return false;
}

function getHashSegments(h) {
  const raw = String(h || location.hash || '').replace(/^#\/?/, '');
  if (!raw) return [];
  return raw.split('/').map(p => {
    try { return decodeURIComponent(p); } catch (e) { return p; }
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

async function routeTo(hash) {
  const segs = getHashSegments(hash);
  if (!segs.length) {
    setHash(['Inicio']);
    showView('view-choose');
    await loadViajes();
    return;
  }

  const head = (segs[0] || '').trim();
  ROUTER_DRIVING = true;

  try {
    if (head.toLowerCase() === 'inicio') {
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
      await goPanel();
      return;
    }

    // Nombre de viaje "plano" (ej: al volver con back del navegador)
    const viaje = await resolveViajeByName(head);
    if (!viaje) { backToChoose(); await loadViajes(); return; }
    await selectViaje(viaje);

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
