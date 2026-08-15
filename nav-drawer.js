// ============================================================
// nav-drawer.js — Menú lateral (hamburguesa) del header
// ============================================================

function openNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const btn = document.getElementById('menuBtn');
  if (!drawer) return;
  drawer.classList.add('show');
  drawer.setAttribute('aria-hidden', 'false');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  document.addEventListener('keydown', _navDrawerEscHandler);
}

function closeNavDrawer() {
  const drawer = document.getElementById('navDrawer');
  const btn = document.getElementById('menuBtn');
  if (!drawer) return;
  drawer.classList.remove('show');
  drawer.setAttribute('aria-hidden', 'true');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('keydown', _navDrawerEscHandler);
}

function _navDrawerEscHandler(ev) {
  if (ev.key === 'Escape') closeNavDrawer();
}

window.openNavDrawer = openNavDrawer;
window.closeNavDrawer = closeNavDrawer;
