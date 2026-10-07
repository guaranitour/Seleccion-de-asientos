// ============================================================
// seats-presence.js — Asientos "en proceso" (Supabase Realtime Presence)
// ============================================================
// Mientras alguien tiene asientos marcados y todavía no confirmó la
// reserva, los demás los ven en ámbar ("Otra persona lo está eligiendo")
// y no los pueden seleccionar. No se guarda nada en la base: viaja por el
// mismo canal en vivo de la planta. Si la persona cierra la página o se
// queda sin conexión, su marca desaparece sola.
//
// Cada persona tiene 5 minutos desde que marca el primer asiento para
// confirmar; después sus marcas se liberan para los demás.
//
// La reserva final sigue protegida en la base (reservar_asientos bloquea
// el asiento y rechaza si ya no está libre): esto es una ayuda visual
// para evitar choques, no la garantía.
// ============================================================

const HOLD_MS = 5 * 60 * 1000;
const HOLD_WARN_MS = 60 * 1000;

const SeatHold = {
  key: (crypto.randomUUID ? crypto.randomUUID() : 'k' + Date.now() + Math.random().toString(36).slice(2)),
  until: 0,          // vencimiento de mis marcas (ms)
  since: {},         // code -> momento en que lo marqué (para desempatar)
  warned: false,
  ticker: null,
  lastState: {},     // último presenceState() recibido
  others: new Set()  // codes marcados por otras personas (vigentes)
};

/** Opciones de presencia para Api.subscribeToPlanta. */
function seatHoldPresenceOptions() {
  return {
    key: SeatHold.key,
    onSync: (state) => { SeatHold.lastState = state || {}; _seatHoldEvaluate(); },
    onReady: () => seatHoldSync()
  };
}

/** Olvida mis marcas (al cambiar de planta o de viaje). */
function seatHoldReset() {
  SeatHold.until = 0;
  SeatHold.since = {};
  SeatHold.warned = false;
  SeatHold.lastState = {};
  SeatHold.others = new Set();
  _seatHoldStopTicker();
  _seatHoldPill();
}

function seatHoldIsTakenByOther(code) {
  const norm = normalize(code);
  return SeatHold.others.has(norm) && !AppState.selected.has(norm);
}

/** Publica mis asientos marcados (llamar después de cada cambio en la selección). */
function seatHoldSync() {
  const ch = AppState.realtimeChannel;
  const sel = AppState.selected || new Set();

  if (!sel.size) {
    SeatHold.until = 0;
    SeatHold.since = {};
    SeatHold.warned = false;
    _seatHoldStopTicker();
  } else {
    if (!SeatHold.until) {
      SeatHold.until = Date.now() + HOLD_MS;
      SeatHold.warned = false;
      _seatHoldStartTicker();
    }
    const since = {};
    sel.forEach(code => { since[code] = SeatHold.since[code] || Date.now(); });
    SeatHold.since = since;
  }
  _seatHoldPill();

  if (!ch) return;
  try {
    ch.track({ seats: SeatHold.since, until: SeatHold.until });
  } catch (e) {
    console.error('presence track:', e);
  }
}

/** Recalcula qué asientos tienen otras personas y resuelve choques. */
function _seatHoldEvaluate() {
  const now = Date.now();
  const others = new Map(); // code -> { ts, key } del que lo marcó primero
  Object.entries(SeatHold.lastState).forEach(([key, metas]) => {
    if (key === SeatHold.key || !Array.isArray(metas)) return;
    metas.forEach(m => {
      if (!m || !m.seats || !m.until || m.until <= now) return;
      Object.entries(m.seats).forEach(([code, ts]) => {
        const prev = others.get(code);
        if (!prev || ts < prev.ts || (ts === prev.ts && key < prev.key)) others.set(code, { ts, key });
      });
    });
  });

  // Dos personas tocaron el mismo asiento casi a la vez: se lo queda quien
  // lo marcó primero; al otro se le quita de la selección con un aviso.
  const perdidos = [];
  AppState.selected.forEach(code => {
    const o = others.get(code);
    const mine = SeatHold.since[code] || now;
    if (o && (o.ts < mine || (o.ts === mine && o.key < SeatHold.key))) perdidos.push(code);
  });
  if (perdidos.length) {
    perdidos.forEach(c => AppState.selected.delete(c));
    const labels = perdidos.map(c => AppState.numLabels.get(c) || c).join(', ');
    toast(perdidos.length === 1
      ? `Otra persona eligió el asiento ${labels} un instante antes`
      : `Otra persona eligió los asientos ${labels} un instante antes`);
    seatHoldSync();
    syncSelectedCounter();
  }

  const nuevos = new Set(others.keys());
  const cambio = nuevos.size !== SeatHold.others.size || [...nuevos].some(c => !SeatHold.others.has(c));
  SeatHold.others = nuevos;
  if (cambio || perdidos.length) _seatHoldRerender();
}

function _seatHoldRerender() {
  const view = document.getElementById('view-select');
  if (view && view.classList.contains('active')) buildGrid('grid-select', { hideMissing: true });
}

// ── Tiempo límite ──
function _seatHoldStartTicker() {
  _seatHoldStopTicker();
  SeatHold.ticker = setInterval(_seatHoldTick, 1000);
}

function _seatHoldStopTicker() {
  if (SeatHold.ticker) { clearInterval(SeatHold.ticker); SeatHold.ticker = null; }
}

let _seatHoldLastEval = 0;
function _seatHoldTick() {
  const restante = SeatHold.until - Date.now();
  if (restante <= 0) { _seatHoldExpire(); return; }
  if (restante <= HOLD_WARN_MS && !SeatHold.warned) {
    SeatHold.warned = true;
    toast('Te queda 1 minuto para confirmar tu reserva');
  }
  _seatHoldPill();
  // Las marcas ajenas vencidas se liberan aunque no llegue ningún evento.
  if (Date.now() - _seatHoldLastEval > 15000) { _seatHoldLastEval = Date.now(); _seatHoldEvaluate(); }
}

function _seatHoldExpire() {
  AppState.selected = new Set();
  seatHoldSync();
  syncSelectedCounter();
  toast('Pasaron 5 minutos: liberamos tus asientos. Volvé a elegirlos para reservar.');
  const reserve = document.getElementById('view-reserve');
  if (reserve && reserve.classList.contains('active')) showView('view-select');
  _seatHoldRerender();
}

// Re-evaluar periódicamente aunque yo no tenga marcas (para liberar en
// pantalla las marcas vencidas de otros).
setInterval(() => {
  if (AppState.realtimeChannel && !SeatHold.ticker) _seatHoldEvaluate();
}, 15000);

// ── Indicador "Tus asientos están apartados · 4:32" ──
// Va junto al botón "Reservar" en el croquis y arriba del formulario, para
// no tapar el encabezado del viaje.
function _seatHoldPill() {
  let pill = document.getElementById('holdPill');
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'holdPill';
    pill.className = 'hold-pill';
    pill.setAttribute('role', 'status');
    pill.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/></svg><span></span>';
  }
  const enForm = document.getElementById('view-reserve')?.classList.contains('active');
  const destino = enForm ? document.getElementById('reservePageBody') : document.querySelector('#selectActionBar .actions');
  const yaUbicado = enForm ? pill.nextElementSibling === destino : pill.parentElement === destino;
  if (destino && !yaUbicado) {
    if (enForm) destino.parentElement.insertBefore(pill, destino);
    else destino.insertBefore(pill, destino.firstChild);
    if (typeof syncActionBarSpacing === 'function') syncActionBarSpacing();
  }
  if (!SeatHold.until) { pill.hidden = true; return; }
  const s = Math.max(0, Math.ceil((SeatHold.until - Date.now()) / 1000));
  const mm = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
  pill.hidden = false;
  pill.classList.toggle('urgente', s <= HOLD_WARN_MS / 1000);
  pill.querySelector('span').textContent = `Tus asientos están apartados · ${mm}:${ss}`;
}

window.SeatHold = SeatHold;
window.seatHoldPresenceOptions = seatHoldPresenceOptions;
window.seatHoldReset = seatHoldReset;
window.seatHoldSync = seatHoldSync;
window.seatHoldIsTakenByOther = seatHoldIsTakenByOther;
window.seatHoldRefreshPill = _seatHoldPill;
