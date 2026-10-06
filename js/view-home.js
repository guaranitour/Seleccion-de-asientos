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
      instagram: cfg.instagram || '', facebook: cfg.facebook || '', tiktok: cfg.tiktok || '', email: cfg.email || '',
      direccion: cfg.direccion || '', mapsUrl: cfg.maps_url || '',
      horarios: Array.isArray(cfg.horarios) ? cfg.horarios : []
    },
    nosotros: cfg.nosotros || '',
    avisos: db.avisos || [],
    equipo: (db.equipo || []).map(m => ({ nombre: m.nombre, cargo: m.cargo, descripcion: m.descripcion, foto: m.foto_url, whatsapp: m.whatsapp, email: m.email })),
    destinos: (db.destinos || []).map(d => ({
      nombre: d.nombre, pais: d.pais, descripcion: d.descripcion, imagen: d.imagen_url, etiquetas: d.etiquetas || [],
      fecha: formatFechaCorta(d.fecha), precio: d.precio_desde, moneda: d.precio_moneda, precioNota: d.precio_nota
    })),
    faq: (db.faq || []).map(f => ({ pregunta: f.titulo, respuesta: f.cuerpo }))
  };
}

async function renderHome() {
  const greet = document.getElementById('homeGreeting');
  if (greet) greet.textContent = getGreeting();
  const year = document.getElementById('homeFooterYear');
  if (year) year.textContent = new Date().getFullYear();

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

  // Mensajes que llegan ya escritos al abrir WhatsApp.
  const waInfo = _homeWhatsappUrl(c.whatsapp, 'Hola! Me gustaría recibir más info sobre un destino.');
  const waReserva = _homeWhatsappUrl(c.whatsapp, 'Hola! Me gustaría reservar un lugar para un destino.');
  [['homeWaFab', waInfo], ['homeStepsCta', waReserva]].forEach(([id, url]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !url;
    if (url) el.href = url;
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
    // País y fecha: dos píldoras sobre la foto; la fecha, un poco más discreta.
    if (d.pais || d.fecha) {
      const pills = _homeEl('div', 'home-dest-pills');
      if (d.pais) pills.appendChild(_homeEl('span', 'home-dest-pais', d.pais));
      if (d.fecha) {
        const f = _homeEl('span', 'home-dest-fecha');
        f.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>';
        f.appendChild(document.createTextNode(d.fecha));
        pills.appendChild(f);
      }
      img.appendChild(pills);
    }
    const body = _homeEl('div', 'home-dest-body');
    body.appendChild(_homeEl('h3', '', d.nombre));
    if (d.descripcion) body.appendChild(_homeEl('p', '', d.descripcion));
    if (Array.isArray(d.etiquetas) && d.etiquetas.length) {
      const tags = _homeEl('div', 'home-tags');
      d.etiquetas.forEach(t => tags.appendChild(_homeEl('span', '', t)));
      body.appendChild(tags);
    }
    // Precio base al pie de la tarjeta, con un acceso a consultar por WhatsApp.
    const precio = formatPrecio(d.precio, d.moneda);
    const waDest = _homeWhatsappUrl(_homeContenido.whatsapp, 'Hola! Me gustaría recibir más info sobre ' + d.nombre + '.');
    if (precio || waDest) {
      const foot = _homeEl('div', 'home-dest-foot');
      if (precio) {
        const pr = _homeEl('div', 'home-dest-precio');
        pr.appendChild(_homeEl('small', '', 'Desde'));
        pr.appendChild(_homeEl('b', '', precio));
        if (d.precioNota) pr.appendChild(_homeEl('span', '', d.precioNota));
        foot.appendChild(pr);
      }
      if (waDest) {
        const a = _homeEl('a', 'home-dest-cta', 'Consultar');
        a.href = waDest; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', 'Consultar por WhatsApp sobre ' + d.nombre);
        foot.appendChild(a);
      }
      body.appendChild(foot);
    }
    card.appendChild(img);
    card.appendChild(body);
    box.appendChild(card);
  });
}

/**
 * "Quiénes somos": la primera oración va como frase destacada y el resto
 * como texto secundario; si es largo, se recorta con "Leer más". El nombre
 * de la marca escrito en mayúsculas se muestra como "Destino Guaraní".
 */
function _renderHomeAbout(texto) {
  const lead = document.getElementById('homeAboutLead');
  const body = document.getElementById('homeAboutBody');
  const more = document.getElementById('homeAboutMore');
  const limpio = String(texto || '').trim();

  const m = limpio.match(/^([\s\S]+?[.!?])\s+([\s\S]+)$/);
  let primera = m ? m[1] : limpio;
  let resto = m ? m[2] : '';
  // Una primera oración muy larga no funciona como destacado: va todo como cuerpo.
  if (primera.length > 140) { resto = limpio; primera = ''; }

  const conMarca = (el, txt) => {
    el.textContent = '';
    txt.split(/(destino\s+guaran[ií])/i).forEach((parte, i) => {
      if (i % 2) el.appendChild(_homeEl('strong', 'home-about-brand', 'Destino Guaraní'));
      else if (parte) el.appendChild(document.createTextNode(parte));
    });
  };
  conMarca(lead, primera);
  conMarca(body, resto);
  lead.hidden = !primera;
  body.hidden = !resto;

  // "Leer más" solo si el cuerpo pasa de 3 líneas. Se mide cuando la tarjeta
  // ya es visible (al primer render la vista todavía está oculta).
  _homeAboutAbierto = false;
  more.setAttribute('aria-expanded', 'false');
  more.textContent = 'Leer más';
  more.onclick = () => {
    _homeAboutAbierto = !_homeAboutAbierto;
    body.classList.toggle('clamped', !_homeAboutAbierto);
    more.setAttribute('aria-expanded', String(_homeAboutAbierto));
    more.textContent = _homeAboutAbierto ? 'Leer menos' : 'Leer más';
  };
  _homeMedirAbout();
}

let _homeAboutAbierto = false;
function _homeMedirAbout() {
  const body = document.getElementById('homeAboutBody');
  const more = document.getElementById('homeAboutMore');
  if (!body || body.hidden || _homeAboutAbierto || !body.offsetParent) return;
  body.classList.add('clamped');
  const corta = body.scrollHeight > body.clientHeight + 2;
  body.classList.toggle('clamped', corta);
  more.hidden = !corta;
}

if (typeof ResizeObserver === 'function') {
  const _homeAboutObserver = new ResizeObserver(() => requestAnimationFrame(_homeMedirAbout));
  document.addEventListener('DOMContentLoaded', () => {
    const about = document.getElementById('homeAbout');
    if (about) _homeAboutObserver.observe(about);
  });
}

function _renderHomeNosotros(texto, equipo) {
  const sec = document.getElementById('homeNosotros');
  const about = document.getElementById('homeAbout');
  const team = document.getElementById('homeTeam');
  sec.hidden = !texto && !equipo.length;

  about.hidden = !texto;
  _renderHomeAbout(texto);

  team.innerHTML = '';
  team.hidden = !equipo.length;
  document.getElementById('homeTeamLabel').hidden = !equipo.length || !texto;
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
    // Mensaje ya escrito, saludando por el nombre: "Hola Ana! Me gustaría…"
    const primerNombre = String(m.nombre || '').trim().split(/\s+/)[0] || '';
    const wa = _homeWhatsappUrl(m.whatsapp,
      'Hola' + (primerNombre ? ' ' + primerNombre : '') + '! Me gustaría recibir más info sobre un destino.');
    if (wa || m.email) {
      const links = _homeEl('div', 'home-member-links');
      // El correo se muestra completo, en una sola línea (luce el dominio).
      if (m.email) {
        const a = _homeEl('a', 'mail');
        a.href = 'mailto:' + m.email;
        a.setAttribute('aria-label', 'Enviar un correo a ' + m.nombre + ': ' + m.email);
        a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
        a.appendChild(_homeEl('span', '', m.email));
        links.appendChild(a);
      }
      if (wa) {
        const a = _homeEl('a', 'wa', 'WhatsApp');
        a.href = wa; a.target = '_blank'; a.rel = 'noopener';
        a.setAttribute('aria-label', 'Escribir por WhatsApp a ' + m.nombre);
        links.appendChild(a);
      }
      card.appendChild(links);
    }
    team.appendChild(card);
  });
  requestAnimationFrame(_homeAjustarCorreos);
}

/**
 * Si un correo muy largo no entra en el ancho de la tarjeta, se achica la
 * letra (hasta ~10px) en vez de cortarlo en dos líneas.
 */
function _homeAjustarCorreos() {
  document.querySelectorAll('#homeTeam a.mail span').forEach(span => {
    span.style.fontSize = '';
    const link = span.parentElement;
    const svg = link.querySelector('svg');
    const gap = parseFloat(getComputedStyle(link).columnGap) || 0;
    const disponible = link.parentElement.clientWidth - (svg ? svg.getBoundingClientRect().width + gap : 0);
    let px = parseFloat(getComputedStyle(span).fontSize);
    while (span.scrollWidth > disponible && px > 10.5) {
      px -= 0.5;
      span.style.fontSize = px + 'px';
    }
  });
}

// Se recalcula cuando la sección se hace visible o cambia de ancho (girar el
// celular, achicar la ventana). Al primer render la vista todavía está oculta.
if (typeof ResizeObserver === 'function') {
  let _homeAjusteFrame = 0;
  const _homeTeamObserver = new ResizeObserver(() => {
    cancelAnimationFrame(_homeAjusteFrame);
    _homeAjusteFrame = requestAnimationFrame(_homeAjustarCorreos);
  });
  document.addEventListener('DOMContentLoaded', () => {
    const team = document.getElementById('homeTeam');
    if (team) _homeTeamObserver.observe(team);
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

// Íconos de cada medio de contacto (24x24, color = currentColor).
const _HOME_ICONOS = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 13.6c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8Z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.4 2.3 1.9 3.9 4.1 4.2v3.2a7.6 7.6 0 0 1-4.1-1.3v6.4a5.6 5.6 0 1 1-5.6-5.6c.3 0 .6 0 .9.1v3.3a2.4 2.4 0 1 0 1.5 2.2V3h3.2Z"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  oficina: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/></svg>'
};

/** TikTok: acepta el usuario (con o sin @) o el link completo del perfil. */
function _homeTiktok(valor) {
  const v = String(valor || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    const m = v.match(/tiktok\.com\/@([^/?#]+)/i);
    return { href: v, usuario: m ? '@' + m[1] : 'Destino Guaraní' };
  }
  const user = v.replace(/^@/, '');
  return { href: 'https://www.tiktok.com/@' + encodeURIComponent(user), usuario: '@' + user };
}

function _renderHomeContacto(c) {
  const ct = c.contacto || {};
  const sec = document.getElementById('homeContacto');
  const box = document.getElementById('homeContactoList');
  box.innerHTML = '';

  const filas = [];
  const wa = _homeWhatsappUrl(c.whatsapp, 'Hola! Me gustaría recibir más info sobre un destino.');
  if (wa) filas.push({ red: 'whatsapp', label: 'WhatsApp', valor: '+' + String(c.whatsapp).replace(/\D/g, ''), href: wa });
  if (ct.instagram) filas.push({ red: 'instagram', label: 'Instagram', valor: '@' + ct.instagram.replace(/^@/, ''), href: 'https://instagram.com/' + encodeURIComponent(ct.instagram.replace(/^@/, '')) });
  if (ct.facebook) filas.push({ red: 'facebook', label: 'Facebook', valor: 'Destino Guaraní', href: ct.facebook });
  const tt = _homeTiktok(ct.tiktok);
  if (tt) filas.push({ red: 'tiktok', label: 'TikTok', valor: tt.usuario, href: tt.href });
  if (ct.email) filas.push({ red: 'email', label: 'Correo', valor: ct.email, href: 'mailto:' + ct.email });
  if (ct.direccion) filas.push({ red: 'oficina', label: ct.mapsUrl ? 'Oficina · Cómo llegar' : 'Oficina', valor: ct.direccion, href: ct.mapsUrl || '' });

  filas.forEach(f => {
    const row = _homeEl(f.href ? 'a' : 'div', 'home-contact-row');
    if (f.href) {
      row.href = f.href;
      if (!f.href.startsWith('mailto:')) { row.target = '_blank'; row.rel = 'noopener'; }
    }
    const ic = _homeEl('span', 'home-contact-icon ' + f.red);
    ic.setAttribute('aria-hidden', 'true');
    ic.innerHTML = _HOME_ICONOS[f.red] || '';
    row.appendChild(ic);
    const txt = document.createElement('div');
    txt.appendChild(_homeEl('small', '', f.label));
    txt.appendChild(_homeEl('b', '', f.valor));
    row.appendChild(txt);
    if (f.href) {
      const go = _homeEl('span', 'home-contact-go');
      go.setAttribute('aria-hidden', 'true');
      go.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 6 6 6-6 6"/></svg>';
      row.appendChild(go);
    }
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
const _HOME_ICONO_BUS = '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M8 6V4M16 6V4"/><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/></svg>';
const _HOME_ICONO_EVENTO = '<svg fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/><path d="m12 13 1.1 2.2 2.4.3-1.8 1.7.5 2.3-2.2-1.2-2.2 1.2.5-2.3-1.8-1.7 2.4-.3Z"/></svg>';

function _renderHomeNext(viaje) {
  const box = document.getElementById('homeNext');
  if (_homeCountdownTimer) { clearInterval(_homeCountdownTimer); _homeCountdownTimer = null; }
  box.hidden = !viaje;
  if (!viaje) return;

  document.getElementById('homeNextName').textContent = viaje.nombre;
  const icono = box.querySelector('.home-next-icon');
  if (icono) icono.innerHTML = viaje.tipo === 'evento' ? _HOME_ICONO_EVENTO : _HOME_ICONO_BUS;
  const label = box.querySelector('.home-next-label');
  if (label) label.textContent = viaje.tipo === 'evento' ? 'Próximo evento' : 'Próxima salida';

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
    const esEvento = v.tipo === 'evento';
    const isDouble = v.tipo === 'doble_piso';
    const abierta = !!v.activo && !esEvento;

    const card = _homeEl('div', 'trip-card ' + (esEvento ? 'event' : (isDouble ? 'double-floor' : 'single-floor')) + (abierta ? '' : ' closed'));
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
    if (esEvento) right.appendChild(_homeEl('span', 'trip-pill evento', 'Evento'));
    else right.appendChild(_homeEl('span', 'trip-pill' + (isDouble ? ' doble' : ''), isDouble ? 'Doble piso' : 'Convencional'));
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
    if (esEvento) {
      // Sin bus ni asientos: en vez del estado de la selección, un acceso a WhatsApp.
      const waEvento = _homeWhatsappUrl(_homeContenido.whatsapp, 'Hola! Me gustaría recibir más info sobre ' + v.nombre + '.');
      if (waEvento) {
        const a = _homeEl('a', 'home-chip info', 'Más info por WhatsApp');
        a.href = waEvento; a.target = '_blank'; a.rel = 'noopener';
        meta.appendChild(a);
      }
    } else {
      meta.appendChild(_homeEl('span', 'home-chip ' + (abierta ? 'open' : 'soon'),
        abierta ? 'Elegí tu asiento' : 'Selección de asientos próximamente'));
    }
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
  const wa = _homeWhatsappUrl(_homeContenido.whatsapp, 'Hola! Me gustaría recibir más info sobre un destino.');
  if (wa) { window.open(wa, '_blank', 'noopener'); return; }
  toast('Pronto vas a encontrar acá nuestros medios de contacto');
}

window.goHome = goHome;
window.homeHablar = homeHablar;
window.renderHome = renderHome;
window.homeScrollTo = homeScrollTo;
