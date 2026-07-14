// ============================================================
// router.js — Router por hash (#/Inicio, #/ViajeX, etc.)
// ============================================================

let ROUTER_DRIVING = false;
let VIAJES_CACHE = [];

function buildHash(segments) {
  return '#/' + (segments || []).map(s => encodeURIComponent(String(s || ''))).join('/');
}

function setHash(segments) {
  if (ROUTER_DRIVING) return;
  location.hash = buildHash(segments);
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

      await selectViaje(viaje);
      if (targetFloor) {
        const planta = getPlantaFromFloorLabel(viaje, targetFloor);
        if (planta) await chooseFloor(planta);
      }
      return;
    }

    if (head.toLowerCase() === 'mira-tu-asiento') {
      const nombreViaje = segs[1];
      const viaje = await resolveViajeByName(nombreViaje);
      if (!viaje) { toast(`No se encontró el viaje "${nombreViaje}".`); backToChoose(); return; }

      AppState.viaje = viaje;
      updateTripTags();
      clearFindView();
      showView('view-find');
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

    // Nombre de viaje "plano" (ej: al volver con back del navegador)
    const viaje = await resolveViajeByName(head);
    if (!viaje) { backToChoose(); await loadViajes(); return; }
    await selectViaje(viaje);

  } finally {
    ROUTER_DRIVING = false;
  }
}

window.setHash = setHash;
window.routeTo = routeTo;
window.ensureViajesCache = ensureViajesCache;
window.resolveViajeByName = resolveViajeByName;
window.getFloorLabelFromEtiqueta = getFloorLabelFromEtiqueta;
window.getPlantaFromFloorLabel = getPlantaFromFloorLabel;
