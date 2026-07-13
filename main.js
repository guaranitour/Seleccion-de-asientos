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
  const skeleton = document.getElementById('logoSkeleton');
  if (!img) return;
  img.addEventListener('load', () => {
    img.classList.add('ready');
    if (skeleton) skeleton.style.display = 'none';
  });
  // TODO: reemplazar por la URL real del logo (Supabase Storage o estático)
  img.src = 'logo.png';
}

async function start() {
  _loadHeroLogo();

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
