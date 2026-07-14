// ============================================================
// ui-helpers.js — Helpers de UI compartidos por todas las vistas
// ============================================================

function showView(id) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function toast(msg) {
  const bar = document.getElementById('snackbar');
  if (!bar) return;
  bar.textContent = msg;
  bar.classList.add('show');
  setTimeout(() => bar.classList.remove('show'), 2800);
}

let BOOTSTRAPING = true;

function showLoading(msg) {
  const ov = document.getElementById('overlay');
  if (!ov) return;
  ov.querySelector('.loader-text').textContent = msg || 'Cargando…';
  ov.setAttribute('aria-hidden', 'false');
  ov.classList.add('show');
}

function hideLoading() {
  if (BOOTSTRAPING) return;
  const ov = document.getElementById('overlay');
  if (!ov) return;
  ov.classList.remove('show');
  ov.setAttribute('aria-hidden', 'true');
}

function normalize(code) {
  return (code || '').toString().replace(/\u00A0/g, ' ').replace(/\s+/g, '').trim().toUpperCase();
}

function onlyDigits(el) {
  el.value = el.value.replace(/\D+/g, '');
}

function handleEnter(ev, cb) {
  if (ev.key === 'Enter') cb();
}

function markField(el, isInvalid) {
  if (!el) return;
  if (isInvalid) {
    el.classList.add('field-error');
    el.addEventListener('input', function clearError() {
      el.classList.remove('field-error');
      el.removeEventListener('input', clearError);
    });
  } else {
    el.classList.remove('field-error');
  }
}

function updateTripTags() {
  const viaje = AppState.viaje;
  if (!viaje) return;

  const nameEl = document.getElementById('selectTripName');
  if (nameEl) {
    const floorSuffix = (AppState.planta && Array.isArray(viaje.plantas) && viaje.plantas.length > 1)
      ? ' — ' + getFloorLabelFromEtiqueta(AppState.planta.etiqueta)
      : '';
    nameEl.textContent = viaje.nombre + floorSuffix;
  }
}

function syncSelectedCounter() {
  const badge = document.getElementById('selectedCounter');
  const live = document.getElementById('selectedCounterLive');
  const btn = document.getElementById('btnReservePersistent');
  const count = AppState.selected ? AppState.selected.size : 0;

  if (badge) {
    if (count > 0) { badge.textContent = String(count); badge.classList.remove('hidden'); }
    else { badge.textContent = '0'; badge.classList.add('hidden'); }
  }
  if (live) {
    live.textContent = count === 0
      ? 'Sin asientos seleccionados'
      : (count === 1 ? 'Un asiento seleccionado' : (count + ' asientos seleccionados'));
  }
  if (btn) {
    btn.disabled = (count === 0);
    btn.setAttribute('aria-disabled', count === 0 ? 'true' : 'false');
  }
}

// ── Countdown de viajes ──
function getCountdownText(startAtIso) {
  if (!startAtIso) return null;
  const start = new Date(startAtIso).getTime();
  if (Number.isNaN(start)) return null;
  const now = Date.now();
  const diff = start - now;

  if (diff <= 0) return { text: 'En curso', status: 'live' };

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  let text;
  if (days > 0) text = `Faltan ${days}d ${hours}h`;
  else if (hours > 0) text = `Faltan ${hours}h ${mins}m`;
  else text = `Faltan ${mins}m`;

  return { text, status: 'future' };
}

setInterval(() => {
  document.querySelectorAll('.trip-countdown').forEach(el => {
    const startAt = el.dataset.startAt;
    if (!startAt) return;
    const info = getCountdownText(startAt);
    if (!info) return;
    el.textContent = info.text;
    el.classList.toggle('live', info.status === 'live');
    el.classList.toggle('future', info.status === 'future');
  });
}, 1000);

window.showView = showView;
window.toast = toast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.normalize = normalize;
window.onlyDigits = onlyDigits;
window.handleEnter = handleEnter;
window.markField = markField;
window.updateTripTags = updateTripTags;
window.syncSelectedCounter = syncSelectedCounter;
window.getCountdownText = getCountdownText;

// ── Compensar el alto real de la barra flotante de "Reservar" ──
// Evita que la nota del croquis o los últimos asientos queden tapados,
// sin importar cuánto crezca la barra (badge, texto de estado, etc.)
(function observeActionBarHeight() {
  const bar = document.getElementById('selectActionBar');
  const grid = document.getElementById('grid-select');
  if (!bar || !grid || typeof ResizeObserver === 'undefined') return;

  const apply = () => {
    grid.style.paddingBottom = (bar.offsetHeight + 16) + 'px';
  };
  new ResizeObserver(apply).observe(bar);
  apply();
})();
