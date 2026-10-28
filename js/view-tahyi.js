// ============================================================
// view-tahyi.js — TAHÝI, iniciativa social y comunitaria (/tahyi)
// ============================================================
// Lo fijo (ejes) y los valores por defecto de la portada están en index.html. Lo editable
// sale de Panel › Inicio (tablas reservas.tahyi_*): "Próximas acciones",
// "Galería" y "Aliados" se ocultan si no tienen nada cargado.

let _tahyiWhatsapp = '';

const _TAHYI_MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function _tahyiEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function _tahyiWa(mensaje) {
  const n = String(_tahyiWhatsapp || '').replace(/\D/g, '');
  return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(mensaje) : '';
}

async function goTahyi() {
  if (typeof closeFloorSheet === 'function') closeFloorSheet();
  showView('view-tahyi');
  setHash(['Tahyi']);
  window.scrollTo(0, 0);
  await renderTahyi();
}

async function renderTahyi() {
  const year = document.getElementById('tahyiFooterYear');
  if (year) year.textContent = new Date().getFullYear();
  showLoading('Cargando…');
  let c = { config: {}, acciones: [], galeria: [], aliados: [] };
  try {
    c = await Api.getTahyiContenido();
  } catch (e) {
    console.error(e);
  } finally {
    hideLoading();
  }
  const cfg = c.config || {};
  _tahyiWhatsapp = cfg.whatsapp || '';

  // Propósito: el título tiene un texto por defecto; el párrafo, solo si se cargó.
  const lead = document.getElementById('tahyiPropositoLead');
  const body = document.getElementById('tahyiPropositoBody');
  if (cfg.tahyi_proposito_titulo) lead.textContent = cfg.tahyi_proposito_titulo;
  body.textContent = cfg.tahyi_proposito_texto || '';
  body.hidden = !cfg.tahyi_proposito_texto;

  _renderTahyiHero(cfg);
  _renderTahyiAcciones(c.acciones);
  _renderTahyiGaleria(c.galeria);
  _renderTahyiAliados(c.aliados);

  const wa = _tahyiWa('Hola! Me gustaría sumarme a TAHÝI.');
  const cta = document.getElementById('tahyiCtaWa');
  cta.hidden = !wa;
  if (wa) cta.href = wa;
}

// Portada: cada campo vacío conserva el texto que trae index.html.
function _renderTahyiHero(cfg) {
  [['tahyiHeroEtiqueta', cfg.tahyi_hero_etiqueta],
   ['tahyiHeroTitulo', cfg.tahyi_hero_titulo], ['tahyiHeroLema', cfg.tahyi_hero_lema], ['tahyiHeroTexto', cfg.tahyi_hero_texto]]
    .forEach(([id, v]) => { if (v) document.getElementById(id).textContent = v; });
  const img = document.getElementById('tahyiHeroImg');
  const url = cfg.tahyi_hero_imagen_url;
  if (url) {
    const src = encodeURI(url);
    if (img.getAttribute('src') !== src) img.src = src;
  } else {
    img.removeAttribute('src');
  }
  img.hidden = !url;
  document.getElementById('tahyiHeroPhoto').classList.toggle('con-foto', !!url);
}

function _renderTahyiAcciones(acciones) {
  const sec = document.getElementById('tahyiAcciones');
  const box = document.getElementById('tahyiAccionesList');
  box.innerHTML = '';
  sec.hidden = !acciones.length;
  document.getElementById('tahyiVerAcciones').hidden = !acciones.length;

  acciones.forEach(a => {
    const colecta = a.tipo === 'colecta';
    const card = _tahyiEl('article', 'tahyi-accion home-glass');
    const head = _tahyiEl('div', 'tahyi-accion-head');

    const fecha = _tahyiEl('div', 'tahyi-fecha' + (colecta ? ' colecta' : ''));
    if (a.fecha) {
      const [, m, d] = String(a.fecha).slice(0, 10).split('-');
      fecha.appendChild(_tahyiEl('b', '', String(Number(d))));
      fecha.appendChild(_tahyiEl('span', '', _TAHYI_MESES[Number(m) - 1] || ''));
      fecha.setAttribute('aria-label', formatFechaCorta(a.fecha));
    } else {
      fecha.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>';
    }
    head.appendChild(fecha);

    const txt = _tahyiEl('div', 'tahyi-accion-text');
    txt.appendChild(_tahyiEl('h3', '', a.titulo));
    const sub = [a.lugar, a.hora].filter(Boolean).join(' · ');
    if (sub) txt.appendChild(_tahyiEl('p', '', sub));
    head.appendChild(txt);
    card.appendChild(head);

    if (a.detalle) card.appendChild(_tahyiEl('p', 'tahyi-accion-detalle', a.detalle));

    const foot = _tahyiEl('div', 'tahyi-accion-foot');
    foot.appendChild(_tahyiEl('span', 'home-chip ' + (colecta ? 'soon' : 'open'), colecta ? 'Colecta' : 'Inscripciones abiertas'));
    const wa = _tahyiWa(colecta
      ? 'Hola! Quiero donar para la colecta de TAHÝI: ' + a.titulo + '.'
      : 'Hola! Quiero anotarme en la acción de TAHÝI: ' + a.titulo + '.');
    if (wa) {
      const btn = _tahyiEl('a', 'tahyi-pill-btn' + (colecta ? ' light' : ''), colecta ? 'Cómo donar' : 'Anotarme');
      btn.href = wa; btn.target = '_blank'; btn.rel = 'noopener';
      btn.setAttribute('aria-label', (colecta ? 'Cómo donar para ' : 'Anotarme en ') + a.titulo);
      foot.appendChild(btn);
    }
    card.appendChild(foot);
    box.appendChild(card);
  });
}

function _renderTahyiGaleria(fotos) {
  const sec = document.getElementById('tahyiGaleria');
  const box = document.getElementById('tahyiGaleriaList');
  box.innerHTML = '';
  sec.hidden = !fotos.length;
  fotos.forEach(f => {
    const fig = _tahyiEl('figure', 'tahyi-foto home-glass');
    const img = document.createElement('img');
    img.src = f.imagen_url; img.alt = f.titulo || ''; img.loading = 'lazy'; img.decoding = 'async';
    fig.appendChild(img);
    const cap = _tahyiEl('figcaption', '', f.titulo);
    if (f.detalle) cap.appendChild(_tahyiEl('span', '', f.detalle));
    fig.appendChild(cap);
    box.appendChild(fig);
  });
}

function _renderTahyiAliados(aliados) {
  const sec = document.getElementById('tahyiAliados');
  const box = document.getElementById('tahyiAliadosList');
  box.innerHTML = '';
  sec.hidden = !aliados.length;
  aliados.forEach(a => {
    const link = /^https?:\/\//i.test(a.link || '') ? a.link : '';
    const el = _tahyiEl(link ? 'a' : 'div', 'tahyi-aliado home-glass');
    if (link) { el.href = link; el.target = '_blank'; el.rel = 'noopener'; }
    if (a.logo_url) {
      const img = document.createElement('img');
      img.src = a.logo_url; img.alt = a.nombre; img.loading = 'lazy';
      el.appendChild(img);
    } else {
      el.textContent = a.nombre;
    }
    box.appendChild(el);
  });
}

function tahyiScrollTo(id) {
  const el = document.getElementById(id);
  if (el && !el.hidden) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.goTahyi = goTahyi;
window.renderTahyi = renderTahyi;
window.tahyiScrollTo = tahyiScrollTo;
