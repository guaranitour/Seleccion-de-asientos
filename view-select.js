// ============================================================
// view-select.js — Vista de selección de asientos (público)
// ============================================================

async function goSelect() {
  if (!AppState.viaje || !AppState.planta) { toast('Elegí un viaje primero'); return; }

  updateTripTags();
  showView('view-select');
  showLoading('Cargando croquis…');

  AppState.selected = new Set();
  await refreshSeats('grid-select', { hideMissing: true });
  subscribeSeatsRealtime();

  hideLoading();
  setHash(['Selección de asientos', AppState.viaje.nombre,
    AppState.viaje.plantas.length > 1 ? getFloorLabelFromEtiqueta(AppState.planta.etiqueta) : undefined
  ].filter(Boolean));
}

window.goSelect = goSelect;
