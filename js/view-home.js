// ============================================================
// view-home.js — Página de inicio
// ============================================================
// "Próximos viajes" sale de reservas.viajes (publicado_inicio = true).
// El resto del contenido sale de INICIO_CONTENIDO (inicio-contenido.js);
// los bloques vacíos se ocultan.

let _homeCountdownTimer = null;

const _WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 13.6c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2Z"/></svg>';

function _homeEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function _homeWhatsappUrl(numero, mensaje) {
  const n = String(numero || '').replace(/\D/g, '');
  if (!n) return '';
  return 'https://wa.me/' + n + (mensaje ? '?text=' + encodeURIComponent(mensaje) : '');
}

async function goHome() {
  if (typeof closeFloorSheet === 'function') closeFloorSheet();
  showView('view-home');
  setHash([]);
  window.scrollTo(0, 0);
  await renderHome();
}

async function renderHome() {
  const c = window.INICIO_CONTENIDO || {};
  const greet = document.getElementById('homeGreeting');
  if (greet) greet.textContent = getGreeting();
  _renderHomeStatic(c);

  showLoading('Cargando…');
  let viajes = [];
  try {
    viajes = await Api.getViajesInicio();
  } catch (e) {
    console.error(e);
    toast('No se pudieron cargar los próximos viajes');
  } finally {
    hideLoading();
  }
  _renderHomeNext(viajes.find(v => v.start_at && new Date(v.start_at).getTime() > Date.now()) || null);
  _renderHomeTrips(viajes);
}

// ── Contenido fijo (portada, destinos, equipo, preguntas, contacto) ──
function _renderHomeStatic(c) {
  const portada = c.portada || {};
  if (portada.titulo) document.getElementById('homeHeroTitle').textContent = portada.titulo;
  if (portada.texto) document.getElementById('homeHeroText').textContent = portada.texto;

  const waUrl = _homeWhatsappUrl(c.whatsapp, 'Hola, quiero reservar un lugar para un viaje.');
  const fab = document.getElementById('homeWaFab');
  const stepsCta = document.getElementById('homeStepsCta');
  [fab, stepsCta].forEach(el => {
    if (!el) return;
    el.hidden = !waUrl;
    if (waUrl) el.href = waUrl;
  });

  _renderHomeDestinos(c.destinos || []);
  _renderHomeNosotros(c.nosotros || '', c.equipo || []);
  _renderHomeFaq(c.faq || []);
  _renderHomeContacto(c);
}

function _renderHomeDestinos(destinos) {
  const sec = document.getElementById('homeDestinos');
  const box = document.getElementById('homeDestinosList');
  box.innerHTML = '';
  sec.hidden = !destinos.length;
  destinos.forEach(d => {
    const card = _homeEl('article', 'home-dest home-glass');
    const img = _homeEl('div', 'home-dest-img');
    if (d.imagen) img.style.backgroundImage = `url("${encodeURI(d.imagen)}")`;
    if (d.pais) img.appendChild(_homeEl('span', '', d.pais));
    const body = _homeEl('div', 'home-dest-body');
    body.appendChild(_homeEl('h3', '', d.nombre));
    if (d.descripcion) body.appendChild(_homeEl('p', '', d.descripcion));
    if (Array.isArray(d.etiquetas) && d.etiquetas.length) {
      const tags = _homeEl('div', 'home-tags');
      d.etiquetas.forEach(t => tags.appendChild(_homeEl('span', '', t)));
      body.appendChild(tags);
    }
    card.appendChild(img);
    card.appendChild(body);
    box.appendChild(card);
  });
}

function _renderHomeNosotros(texto, equipo) {
  const sec = document.getElementById('homeNosotros');
  const about = document.getElementById('homeAbout');
  const team = document.getElementById('homeTeam');
  sec.hidden = !texto && !equipo.length;

  about.hidden = !texto;
  about.querySelector('p').textContent = texto;

  team.innerHTML = '';
  team.hidden = !equipo.length;
  equipo.forEach(m => {
    const card = _homeEl('article', 'home-member home-glass');
    const av = _homeEl('div', 'home-avatar');
    if (m.foto) {
      const img = document.createElement('img');
      img.src = m.foto; img.alt = ''; img.loading = 'lazy';
      av.appendChild(img);
    } else {
      av.textContent = String(m.nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    card.appendChild(av);
    if (m.cargo) card.appendChild(_homeEl('div', 'home-role', m.cargo));
    card.appendChild(_homeEl('h3', '', m.nombre));
    if (m.descripcion) card.appendChild(_homeEl('p', '', m.descripcion));
    const wa = _homeWhatsappUrl(m.whatsapp);
    if (wa) {
      const a = _homeEl('a', '', 'Escribile');
      a.href = wa; a.target = '_blank'; a.rel = 'noopener';
      card.appendChild(a);
    }
    team.appendChild(card);
  });
}

function _renderHomeFaq(faq) {
  const sec = document.getElementById('homeFaq');
  const box = document.getElementById('homeFaqList');
  box.innerHTML = '';
  sec.hidden = !faq.length;
  faq.forEach((f, i) => {
    const det = document.createElement('details');
    if (i === 0) det.open = true;
    det.appendChild(_homeEl('summary', '', f.pregunta));
    det.appendChild(_homeEl('p', '', f.respuesta));
    box.appendChild(det);
  });
}

function _renderHomeContacto(c) {
  const ct = c.contacto || {};
  const sec = document.getElementById('homeContacto');
  const box = document.getElementById('homeContactoList');
  box.innerHTML = '';

  const filas = [];
  const wa = _homeWhatsappUrl(c.whatsapp);
  if (wa) filas.push({ label: 'WhatsApp', valor: '+' + String(c.whatsapp).replace(/\D/g, ''), href: wa });
  if (ct.instagram) filas.push({ label: 'Instagram', valor: '@' + ct.instagram.replace(/^@/, ''), href: 'https://instagram.com/' + encodeURIComponent(ct.instagram.replace(/^@/, '')) });
  if (ct.facebook) filas.push({ label: 'Facebook', valor: 'Destino Guaraní', href: ct.facebook });
  if (ct.email) filas.push({ label: 'Correo', valor: ct.email, href: 'mailto:' + ct.email });
  if (ct.direccion) filas.push({ label: ct.mapsUrl ? 'Oficina · Cómo llegar' : 'Oficina', valor: ct.direccion, href: ct.mapsUrl || '' });

  filas.forEach(f => {
    const row = _homeEl(f.href ? 'a' : 'div', 'home-contact-row');
    if (f.href) {
      row.href = f.href;
      if (!f.href.startsWith('mailto:')) { row.target = '_blank'; row.rel = 'noopener'; }
    }
    const txt = document.createElement('div');
    txt.appendChild(_homeEl('small', '', f.label));
    txt.appendChild(_homeEl('b', '', f.valor));
    row.appendChild(txt);
    box.appendChild(row);
  });

  const horarios = Array.isArray(ct.horarios) ? ct.horarios : [];
  if (horarios.length) {
    const dl = _homeEl('dl', 'home-hours');
    horarios.forEach(h => {
      dl.appendChild(_homeEl('dt', '', h.dia));
      dl.appendChild(_homeEl('dd', '', h.hora));
    });
    box.appendChild(dl);
  }

  sec.hidden = !filas.length && !horarios.length;
}

// ── Próxima salida (portada) ──
function _renderHomeNext(viaje) {
  const box = document.getElementById('homeNext');
  if (_homeCountdownTimer) { clearInterval(_homeCountdownTimer); _homeCountdownTimer = null; }
  box.hidden = !viaje;
  if (!viaje) return;

  document.getElementById('homeNextName').textContent = viaje.nombre;

  const target = new Date(viaje.start_at).getTime();
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    box.querySelector('[data-u="d"]').textContent = Math.floor(ms / 86400000);
    box.querySelector('[data-u="h"]').textContent = pad(Math.floor(ms / 3600000) % 24);
    box.querySelector('[data-u="m"]').textContent = pad(Math.floor(ms / 60000) % 60);
  };
  tick();
  _homeCountdownTimer = setInterval(() => {
    if (!document.getElementById('view-home').classList.contains('active')) return;
    tick();
  }, 30000);
}

// ── Próximos viajes ──
function _renderHomeTrips(viajes) {
  const list = document.getElementById('homeTripList');
  list.innerHTML = '';

  if (!viajes.length) {
    list.appendChild(_homeEl('div', 'home-empty home-glass',
      'Pronto publicaremos nuevas salidas.'));
    return;
  }

  viajes.forEach(v => {
    const isDouble = v.tipo === 'doble_piso';
    const abierta = !!v.activo;

    const card = _homeEl('div', 'trip-card ' + (isDouble ? 'double-floor' : 'single-floor') + (abierta ? '' : ' closed'));
    const head = _homeEl('div', 'trip-head');
    const left = _homeEl('div', 'trip-head-left');
    const nameWrap = _homeEl('div');
    nameWrap.style.cssText = 'min-width:0;flex:1';
    nameWrap.appendChild(_homeEl('h3', '', v.nombre));
    left.appendChild(nameWrap);
    const right = _homeEl('div', 'trip-head-right');
    right.appendChild(_homeEl('span', 'trip-pill' + (isDouble ? ' doble' : ''), isDouble ? 'Doble piso' : 'Convencional'));
    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const meta = _homeEl('div', 'home-trip-meta');
    const info = v.start_at ? getCountdownText(v.start_at) : null;
    if (info) {
      const cd = _homeEl('span', 'trip-countdown ' + info.status, info.text);
      cd.dataset.startAt = v.start_at;
      meta.appendChild(cd);
    }
    meta.appendChild(_homeEl('span', 'home-chip ' + (abierta ? 'open' : 'soon'),
      abierta ? 'Elegí tu asiento' : 'Selección de asientos próximamente'));
    card.appendChild(meta);

    if (abierta) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      const abrir = () => selectViaje(v).catch(err => { console.error(err); toast('No se pudo abrir el viaje'); });
      card.onclick = abrir;
      card.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); abrir(); } };
    }
    list.appendChild(card);
  });
}

function homeScrollTo(id) {
  const el = document.getElementById(id);
  if (el && !el.hidden) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Acceso rápido "Hablar con nosotros": va a Contacto, o abre WhatsApp. */
function homeHablar() {
  const sec = document.getElementById('homeContacto');
  if (sec && !sec.hidden) { homeScrollTo('homeContacto'); return; }
  const wa = _homeWhatsappUrl((window.INICIO_CONTENIDO || {}).whatsapp);
  if (wa) { window.open(wa, '_blank', 'noopener'); return; }
  toast('Pronto vas a encontrar acá nuestros medios de contacto');
}

window.goHome = goHome;
window.homeHablar = homeHablar;
window.renderHome = renderHome;
window.homeScrollTo = homeScrollTo;
