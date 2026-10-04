// ============================================================
// view-home.js — Página de inicio
// ============================================================
// "Próximos viajes" sale de reservas.viajes (publicado_inicio = true).
// El resto se edita en Panel › Inicio (tablas reservas.inicio_*); los
// bloques vacíos se ocultan.

let _homeCountdownTimer = null;
let _homeContenido = {};

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

/** Pasa lo que viene de Supabase al formato que usan los render. */
function _homeMapContenido(db) {
  const cfg = db.config || {};
  return {
    portada: { titulo: cfg.portada_titulo, texto: cfg.portada_texto, imagen: cfg.portada_imagen_url },
    whatsapp: cfg.whatsapp || '',
    contacto: {
      instagram: cfg.instagram || '', facebook: cfg.facebook || '', email: cfg.email || '',
      direccion: cfg.direccion || '', mapsUrl: cfg.maps_url || '',
      horarios: Array.isArray(cfg.horarios) ? cfg.horarios : []
    },
    nosotros: cfg.nosotros || '',
    avisos: db.avisos || [],
    equipo: (db.equipo || []).map(m => ({ nombre: m.nombre, cargo: m.cargo, descripcion: m.descripcion, foto: m.foto_url, whatsapp: m.whatsapp, email: m.email })),
    destinos: (db.destinos || []).map(d => ({ nombre: d.nombre, pais: d.pais, descripcion: d.descripcion, imagen: d.imagen_url, etiquetas: d.etiquetas || [] })),
    faq: (db.faq || []).map(f => ({ pregunta: f.titulo, respuesta: f.cuerpo }))
  };
}

async function renderHome() {
  const greet = document.getElementById('homeGreeting');
  if (greet) greet.textContent = getGreeting();

  showLoading('Cargando…');
  let viajes = [];
  const [rViajes, rContenido] = await Promise.allSettled([Api.getViajesInicio(), Api.getInicioContenido()]);
  hideLoading();

  if (rContenido.status === 'fulfilled') {
    _homeContenido = _homeMapContenido(rContenido.value);
    _renderHomeStatic(_homeContenido);
  } else {
    console.error(rContenido.reason);
  }
  if (rViajes.status === 'fulfilled') {
    viajes = rViajes.value;
  } else {
    console.error(rViajes.reason);
    toast('No se pudieron cargar los próximos viajes');
  }
  _renderHomeNext(viajes.find(v => v.start_at && new Date(v.start_at).getTime() > Date.now()) || null);
  _renderHomeTrips(viajes);
}

// ── Contenido fijo (portada, destinos, equipo, preguntas, contacto) ──
function _renderHomeStatic(c) {
  const portada = c.portada || {};
  if (portada.titulo) document.getElementById('homeHeroTitle').textContent = portada.titulo;
  if (portada.texto) document.getElementById('homeHeroText').textContent = portada.texto;
  const photo = document.getElementById('homeHeroPhoto');
  photo.classList.toggle('has-img', !!portada.imagen);
  photo.style.backgroundImage = portada.imagen ? `url("${encodeURI(portada.imagen)}")` : '';

  _renderHomeAvisos(c.avisos || []);

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
  if (typeof syncNavDrawerSections === 'function') syncNavDrawerSections();
}

function _renderHomeAvisos(avisos) {
  const box = document.getElementById('homeAvisos');
  box.innerHTML = '';
  box.hidden = !avisos.length;
  avisos.forEach(a => {
    const el = _homeEl('div', 'home-notice' + (a.estilo === 'importante' ? ' important' : ''));
    el.setAttribute('role', a.estilo === 'importante' ? 'alert' : 'status');
    const txt = _homeEl('div');
    txt.appendChild(_homeEl('b', '', a.titulo));
    if (a.cuerpo) txt.appendChild(_homeEl('p', '', a.cuerpo));
    el.appendChild(txt);
    box.appendChild(el);
  });
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
    if (wa || m.email) {
      const links = _homeEl('div', 'home-member-links');
      if (wa) {
        const a = _homeEl('a', 'wa', 'WhatsApp');
        a.href = wa; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', 'Escribir por WhatsApp a ' + m.nombre);
        links.appendChild(a);
      }
      if (m.email) {
        const a = _homeEl('a', 'mail', 'Correo');
        a.href = 'mailto:' + m.email;
        a.title = m.email;
        a.setAttribute('aria-label', 'Enviar un correo a ' + m.nombre + ' (' + m.email + ')');
        links.appendChild(a);
      }
      card.appendChild(links);
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
    const foto = v.destino && v.destino.imagen_url;
    if (foto) {
      card.classList.add('has-photo');
      const ph = _homeEl('div', 'home-trip-photo');
      ph.style.backgroundImage = `url("${encodeURI(foto)}")`;
      card.appendChild(ph);
    }
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
  const wa = _homeWhatsappUrl(_homeContenido.whatsapp);
  if (wa) { window.open(wa, '_blank', 'noopener'); return; }
  toast('Pronto vas a encontrar acá nuestros medios de contacto');
}

window.goHome = goHome;
window.homeHablar = homeHablar;
window.renderHome = renderHome;
window.homeScrollTo = homeScrollTo;
