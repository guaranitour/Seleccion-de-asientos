// ============================================================
// state.js — Estado global de la aplicación (público)
// ============================================================

const AppState = {
  // Viaje / planta actual
  viaje: null,        // { id, nombre, tipo, start_at, plantas: [...] }
  planta: null,        // { id, etiqueta } — planta activa (croquis visible)

  // Selección de asientos (croquis público)
  selected: new Set(), // codes seleccionados por el usuario ('1A', etc.)

  // Cache de asientos de la planta activa: code -> { id, estado, pasajero, ci, numero_visible }
  seatsByCode: new Map(),

  // Numeración visible (code -> número secuencial mostrado al público)
  numLabels: new Map(),

  // Resultados de "Mirá tu asiento"
  highlightCodes: new Set(),

  // Control de concurrencia / loading
  busy: false,
  gridLoading: false,

  // Suscripción realtime activa (para poder cancelarla al cambiar de planta)
  realtimeChannel: null
};

function resetSelection() {
  AppState.selected = new Set();
}

function resetViajeState() {
  AppState.viaje = null;
  AppState.planta = null;
  AppState.seatsByCode = new Map();
  AppState.numLabels = new Map();
  AppState.highlightCodes = new Set();
  resetSelection();
  unsubscribeRealtime();
}

function unsubscribeRealtime() {
  if (AppState.realtimeChannel) {
    supabase.removeChannel(AppState.realtimeChannel);
    AppState.realtimeChannel = null;
  }
}

window.AppState = AppState;
window.resetSelection = resetSelection;
window.resetViajeState = resetViajeState;
window.unsubscribeRealtime = unsubscribeRealtime;
