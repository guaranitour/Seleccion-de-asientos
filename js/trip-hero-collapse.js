// ============================================================
// trip-hero-collapse.js — Colapsa la card de saludo/título de
// view-choose a medida que el usuario scrollea la lista de viajes.
// El logo del topbar (fixed, fuera de esta card) siempre queda visible.
// ============================================================

const TRIP_HERO_COLLAPSE_THRESHOLD = 40; // px de scroll antes de colapsar

let _tripHeroTicking = false;

function _updateTripHeroCollapse() {
  _tripHeroTicking = false;
  const card = document.getElementById('tripHeroCard');
  if (!card) return;
  // Solo aplica mientras view-choose está activa.
  const view = document.getElementById('view-choose');
  if (!view || !view.classList.contains('active')) return;

  const collapsed = window.scrollY > TRIP_HERO_COLLAPSE_THRESHOLD;
  card.classList.toggle('collapsed', collapsed);
}

window.addEventListener('scroll', () => {
  if (_tripHeroTicking) return;
  _tripHeroTicking = true;
  requestAnimationFrame(_updateTripHeroCollapse);
}, { passive: true });
