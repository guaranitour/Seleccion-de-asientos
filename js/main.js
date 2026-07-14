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
  img.src = 'guaranitour_512.png';
}

async function start() {
  _loadHeroLogo();
  await Auth.init();
  updateStaffEntryPoint();

  window.addEventListener('hashchange', () => {
    if (!ROUTER_DRIVING) routeTo(location.hash);
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
