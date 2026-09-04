// ============================================================
// ui-helpers.js — Helpers de UI compartidos por todas las vistas
// ============================================================

const STAFF_VIEW_IDS = ['view-staff-login', 'view-panel', 'view-control', 'view-editor', 'view-passenger-list'];

function showView(id) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  // Cerrar cualquier bottom-sheet / action-sheet abierto al navegar a una
  // vista real, para que nunca quede tapando la pantalla (ej. al volver
  // atrás desde el navegador estando el sheet de planta abierto).
  document.querySelectorAll('.action-sheet.show').forEach(sheet => sheet.classList.remove('show'));
  if (typeof closeNavDrawer === 'function') closeNavDrawer();

  // Fallback por si el navegador no soporta el selector :has() usado en
  // panel.css para esconder el botón flotante de staff dentro de sus
  // propias vistas (login/panel/control/editor).
  const staffBtn = document.getElementById('staffEntryBtn');
  if (staffBtn) staffBtn.classList.toggle('hidden', STAFF_VIEW_IDS.includes(id));
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

/**
 * Limpia un CI para guardarlo en la base: solo dígitos, sin puntos,
 * espacios ni guiones. onlyDigits() ya hace esto en vivo mientras se
 * escribe, pero esta versión (pura, no toca el DOM) es la que se usa
 * justo antes de mandar el dato al servidor — cubre el caso de un valor
 * pegado (paste) que por algún motivo llegó con algo no numérico.
 */
function normalizeCI(ci) {
  return (ci || '').toString().replace(/\D+/g, '');
}

// Palabras que van en minúscula dentro de un nombre compuesto, salvo que
// sean la primera palabra (p. ej. "María de los Ángeles", "Juan de Dios").
const NOMBRE_MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

/**
 * Normaliza un nombre a Title Case, evitando que quede todo en mayúsculas
 * o minúsculas por cómo lo tipeó la persona. Respeta apóstrofes y guiones
 * (D'Angelo, Pérez-Gómez) y deja en minúscula las preposiciones/artículos
 * típicos de nombres compuestos en español, excepto al inicio.
 */
function normalizeNombre(nombre) {
  const limpio = (nombre || '').toString().trim().replace(/\s+/g, ' ');
  if (!limpio) return '';

  return limpio
    .toLowerCase()
    .split(' ')
    .map((palabra, i) => {
      if (i > 0 && NOMBRE_MINUSCULAS.has(palabra)) return palabra;
      // Capitaliza cada segmento separado por ' o -, para D'Angelo / Pérez-Gómez
      return palabra
        .split(/([-'])/)
        .map(seg => (seg === '-' || seg === "'") ? seg : seg.charAt(0).toUpperCase() + seg.slice(1))
        .join('');
    })
    .join(' ');
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

  syncActionBarSpacing();
}

/** Ajusta el padding-bottom del contenedor del croquis (grid + nota) al alto
 *  real de la barra flotante de "Reservar", para que la nota y los últimos
 *  asientos nunca queden tapados sin importar cuánto texto tenga el
 *  contador de estado. */
function syncActionBarSpacing() {
  const bar = document.getElementById('selectActionBar');
  const wrap = document.getElementById('croquisWrap') || document.getElementById('grid-select');
  if (!bar || !wrap) return;
  // requestAnimationFrame: esperamos a que el navegador termine de
  // pintar el nuevo texto del contador antes de medir la altura real.
  requestAnimationFrame(() => {
    wrap.style.paddingBottom = (bar.offsetHeight + 16) + 'px';
  });
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

// ── Saludo corto según hora del día (sin asumir visitas previas) ──
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 6) return 'Buenas noches';
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('helloGreeting');
  if (el) el.textContent = getGreeting();
});

window.getGreeting = getGreeting;
window.showView = showView;
window.toast = toast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.normalize = normalize;
window.onlyDigits = onlyDigits;
window.normalizeCI = normalizeCI;
window.normalizeNombre = normalizeNombre;
window.handleEnter = handleEnter;
window.markField = markField;
window.updateTripTags = updateTripTags;
window.syncSelectedCounter = syncSelectedCounter;
window.syncActionBarSpacing = syncActionBarSpacing;
window.getCountdownText = getCountdownText;
