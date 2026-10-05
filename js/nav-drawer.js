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

// Qué ítem del menú marcar como actual según la vista visible.
const NAV_ITEM_POR_VISTA = {
  'view-home': 'inicio',
  'view-choose': 'seleccion', 'view-select': 'seleccion', 'view-reserve': 'seleccion', 'view-confirmed': 'seleccion',
  'view-bases': 'bases',
  'view-staff-login': 'staff', 'view-panel': 'staff', 'view-create-trip': 'staff', 'view-control': 'staff',
  'view-editor': 'staff', 'view-passenger-list': 'staff', 'view-panel-inicio': 'staff'
};

function syncNavDrawerCurrent(viewId) {
  const actual = NAV_ITEM_POR_VISTA[viewId] || '';
  document.querySelectorAll('#navDrawer .nav-drawer-item').forEach(btn => {
    const es = btn.dataset.nav === actual;
    btn.classList.toggle('current', es);
    if (es) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });
}

/** Muestra en el menú (y en el pie del inicio) solo las secciones que tienen contenido. */
function syncNavDrawerSections() {
  document.querySelectorAll('#navDrawer .nav-drawer-item[data-section], #homeFooter [data-section]').forEach(btn => {
    const sec = document.getElementById(btn.dataset.section);
    btn.hidden = !sec || sec.hidden;
  });
}

/** Destinos / Quiénes somos / Contacto: va al inicio y baja a esa sección. */
async function navGoHomeSection(sectionId) {
  closeNavDrawer();
  const enInicio = document.getElementById('view-home')?.classList.contains('active');
  if (!enInicio) await goHome();
  homeScrollTo(sectionId);
}

window.syncNavDrawerCurrent = syncNavDrawerCurrent;
window.syncNavDrawerSections = syncNavDrawerSections;
window.navGoHomeSection = navGoHomeSection;
window.openNavDrawer = openNavDrawer;
window.closeNavDrawer = closeNavDrawer;
