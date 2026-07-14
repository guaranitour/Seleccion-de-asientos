// ============================================================
// main.js — Bootstrap de la aplicación
// ============================================================

(function () {
  function setVH() {
    const h = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', (h * 0.01) + 'px');
  }
  setVH();
  window.addEventListener('resize', setVH, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setVH, { passive: true });
    window.visualViewport.addEventListener('scroll', setVH, { passive: true });
  }
})();

function _loadHeroLogo() {
  const img = document.getElementById('heroLogo');
  if (!img) return;
  img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
  img.addEventListener('error', () => img.classList.add('loaded'), { once: true });
  img.src = 'Logo.png';
}

async function start() {
  _loadHeroLogo();
  await Auth.init();
  updateStaffEntryPoint();

  window.addEventListener('hashchange', () => {
    if (ROUTER_DRIVING) return;
    if (isProgrammaticHashChange()) return; // ya lo maneja quien llamó a setHash()
    routeTo(location.hash);
  }, { passive: true });

  await routeTo(location.hash);
  document.body.classList.add('app-ready');
  BOOTSTRAPING = false;
  hideLoading();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
