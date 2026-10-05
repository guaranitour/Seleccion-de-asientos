// ============================================================
// view-panel-inicio.js — Panel › Inicio (solo admin)
// Edita el contenido de la página de inicio: portada, avisos, preguntas
// frecuentes, equipo, destinos y contacto. Tablas reservas.inicio_*.
// ============================================================

const PI_SECCIONES = {
  portada: {
    tab: 'Portada',
    tipo: 'config',
    ayuda: 'Título, texto y foto de la portada, y el texto de "Quiénes somos".',
    campos: [
      { k: 'portada_titulo', label: 'Título de la portada', req: true, max: 90 },
      { k: 'portada_texto', label: 'Texto debajo del título', type: 'textarea', max: 220 },
      { k: 'portada_imagen_url', label: 'Foto de la portada', type: 'image', carpeta: 'portada', hint: 'Horizontal, sin texto encima. Si no cargás una, se muestra la ilustración.' },
      { k: 'nosotros', label: 'Quiénes somos', type: 'textarea', rows: 5, hint: 'Párrafo breve sobre la empresa. Vacío = no se muestra.' }
    ]
  },
  avisos: {
    tab: 'Avisos',
    tipo: 'lista',
    tabla: 'inicio_bloques',
    filtro: { tipo: 'aviso' },
    nuevo: { tipo: 'aviso', estilo: 'info' },
    singular: 'aviso',
    ayuda: 'Se muestran debajo de la portada. Con "Mostrar hasta" desaparecen solos.',
    campos: [
      { k: 'titulo', label: 'Título', req: true, max: 90 },
      { k: 'cuerpo', label: 'Texto', type: 'textarea', max: 300 },
      { k: 'estilo', label: 'Estilo', type: 'select', opciones: [['info', 'Informativo (azul)'], ['importante', 'Importante (amarillo)']] },
      { k: 'visible_desde', label: 'Mostrar desde (opcional)', type: 'datetime' },
      { k: 'visible_hasta', label: 'Mostrar hasta (opcional)', type: 'datetime' }
    ],
    resumen: r => _piVigencia(r)
  },
  faq: {
    tab: 'Preguntas',
    tipo: 'lista',
    tabla: 'inicio_bloques',
    filtro: { tipo: 'faq' },
    nuevo: { tipo: 'faq' },
    singular: 'pregunta',
    ayuda: 'Preguntas frecuentes. La primera se muestra abierta.',
    campos: [
      { k: 'titulo', label: 'Pregunta', req: true, max: 120 },
      { k: 'cuerpo', label: 'Respuesta', type: 'textarea', req: true, rows: 4 }
    ],
    resumen: r => r.cuerpo || ''
  },
  equipo: {
    tab: 'Equipo',
    tipo: 'lista',
    tabla: 'inicio_equipo',
    nuevo: {},
    singular: 'integrante',
    ayuda: 'Las personas que aparecen en "Quiénes somos".',
    imagen: 'foto_url',
    campos: [
      { k: 'nombre', label: 'Nombre', req: true, max: 60 },
      { k: 'cargo', label: 'Cargo', max: 40, placeholder: 'Ej.: Coordinación a bordo' },
      { k: 'descripcion', label: 'Descripción breve', type: 'textarea', max: 140 },
      { k: 'foto_url', label: 'Foto', type: 'image', carpeta: 'equipo', maxLado: 600, hint: 'Cuadrada o vertical, con la cara centrada.' },
      { k: 'whatsapp', label: 'WhatsApp (opcional)', type: 'tel', hint: 'Con código de país, ej.: 595981123456. Agrega el botón "WhatsApp".' },
      { k: 'email', label: 'Correo (opcional)', type: 'email', placeholder: 'nombre@ejemplo.com', hint: 'Agrega el botón "Correo".' }
    ],
    resumen: r => r.cargo || ''
  },
  destinos: {
    tab: 'Destinos',
    tipo: 'lista',
    tabla: 'inicio_destinos',
    nuevo: {},
    singular: 'destino',
    ayuda: 'Cada viaje puede tomar la foto de su destino: elegilo en la tarjeta del viaje, en el Panel.',
    imagen: 'imagen_url',
    campos: [
      { k: 'nombre', label: 'Nombre', req: true, max: 60, placeholder: 'Ej.: Encarnación' },
      { k: 'pais', label: 'País', max: 40, placeholder: 'Ej.: Paraguay' },
      { k: 'descripcion', label: 'Descripción breve', type: 'textarea', max: 220 },
      { k: 'imagen_url', label: 'Foto', type: 'image', carpeta: 'destinos', hint: 'Horizontal, sin texto encima, con el motivo principal al centro.' },
      { k: 'etiquetas', label: 'Etiquetas', type: 'tags', hint: 'Separadas por coma, ej.: Fin de semana, Playa' },
      { k: 'fecha_texto', label: 'Fecha (opcional)', max: 40, placeholder: 'Ej.: 24 al 26 de octubre', hint: 'Se muestra sobre la foto, junto al país.' },
      { k: 'precio_desde', label: 'Precio base (opcional)', type: 'number', placeholder: 'Ej.: 450000', hint: 'Solo el número, sin puntos. Se muestra como "Desde Gs. 450.000".' },
      { k: 'precio_moneda', label: 'Moneda', type: 'select', opciones: [['PYG', 'Guaraníes (Gs.)'], ['USD', 'Dólares (US$)'], ['BRL', 'Reales (R$)'], ['ARS', 'Pesos argentinos (AR$)']] },
      { k: 'precio_nota', label: 'Aclaración del precio (opcional)', max: 40, placeholder: 'Ej.: por persona' }
    ],
    resumen: r => [r.pais, r.fecha_texto, r.precio_desde != null ? 'Desde ' + formatPrecio(r.precio_desde, r.precio_moneda) : '']
      .filter(Boolean).join(' · ')
  },
  contacto: {
    tab: 'Contacto',
    tipo: 'config',
    ayuda: 'Medios de contacto. Lo que dejes vacío no se muestra.',
    campos: [
      { k: 'whatsapp', label: 'WhatsApp de reservas', type: 'tel', hint: 'Con código de país, solo números, ej.: 595981123456. Activa el botón flotante y "Reservar por WhatsApp".' },
      { k: 'instagram', label: 'Instagram', placeholder: 'usuario, sin @' },
      { k: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
      { k: 'tiktok', label: 'TikTok', placeholder: 'usuario sin @, o el link del perfil' },
      { k: 'email', label: 'Correo', type: 'email' },
      { k: 'direccion', label: 'Dirección de la oficina' },
      { k: 'maps_url', label: 'Link de Google Maps (opcional)', placeholder: 'https://maps.app.goo.gl/…' },
      { k: 'horarios', label: 'Horarios de atención', type: 'horarios' }
    ]
  }
};

const PiState = { seccion: 'portada', filas: [], config: null };

// ── Navegación ──
async function goPanelInicio(seccion) {
  if (!Auth.isAdmin()) { toast('Solo administradores pueden editar el inicio'); return; }
  if (seccion && PI_SECCIONES[seccion]) PiState.seccion = seccion;
  showView('view-panel-inicio');
  setHash(['Panel', 'Inicio']);
  _piRenderTabs();
  await _piCargarSeccion();
}

function _piRenderTabs() {
  const tabs = document.getElementById('piTabs');
  tabs.innerHTML = '';
  Object.entries(PI_SECCIONES).forEach(([key, sec]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ghost' + (key === PiState.seccion ? ' active-tab' : '');
    btn.textContent = sec.tab;
    btn.setAttribute('aria-pressed', String(key === PiState.seccion));
    btn.onclick = () => { PiState.seccion = key; _piRenderTabs(); _piCargarSeccion(); };
    tabs.appendChild(btn);
  });
}

async function _piCargarSeccion() {
  const sec = PI_SECCIONES[PiState.seccion];
  const body = document.getElementById('piBody');
  body.innerHTML = '';
  body.appendChild(_piEl('p', 'pi-help', sec.ayuda));

  showLoading('Cargando…');
  try {
    if (sec.tipo === 'config') {
      PiState.config = await ApiAdmin.getInicioConfig();
      _piRenderConfig(sec, body);
    } else {
      PiState.filas = await ApiAdmin.listInicio(sec.tabla, sec.filtro);
      _piRenderLista(sec, body);
    }
  } catch (e) {
    console.error(e);
    toast('No se pudo cargar: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

// ── Secciones de una sola ficha (Portada, Contacto) ──
function _piRenderConfig(sec, body) {
  const form = _piBuildForm(sec.campos, PiState.config);
  form.el.classList.add('form', 'pi-form');
  const actions = _piEl('div', 'actions');
  const save = _piEl('button', 'btn primary', 'Guardar cambios');
  save.type = 'submit';
  actions.appendChild(save);
  form.el.appendChild(actions);
  form.el.onsubmit = async (ev) => {
    ev.preventDefault();
    const datos = form.leer();
    if (!datos) return;
    showLoading('Guardando…');
    try {
      await ApiAdmin.saveInicioConfig({ ...PiState.config, ...datos });
      PiState.config = { ...PiState.config, ...datos };
      toast('Cambios guardados');
    } catch (e) {
      toast('Error al guardar: ' + (e.message || ''));
    } finally {
      hideLoading();
    }
  };
  body.appendChild(form.el);
}

// ── Secciones de lista (Avisos, Preguntas, Equipo, Destinos) ──
function _piRenderLista(sec, body) {
  const add = _piEl('button', 'btn primary btn-icon pi-add', '+ Agregar ' + sec.singular);
  add.type = 'button';
  add.onclick = () => _piAbrirEditor(sec, { ...sec.nuevo });
  body.appendChild(add);

  if (!PiState.filas.length) {
    body.appendChild(_piEl('div', 'pi-empty', `Todavía no cargaste ningún ${sec.singular}.`));
    return;
  }

  const list = _piEl('div', 'pi-list');
  PiState.filas.forEach((fila, i) => {
    const item = _piEl('div', 'pi-item' + (fila.activo ? '' : ' inactive'));

    if (sec.imagen) {
      const th = _piEl('div', 'pi-thumb');
      if (fila[sec.imagen]) th.style.backgroundImage = `url("${encodeURI(fila[sec.imagen])}")`;
      else th.textContent = String(fila.nombre || '?').trim().charAt(0).toUpperCase();
      item.appendChild(th);
    }

    const txt = _piEl('div', 'pi-item-text');
    txt.appendChild(_piEl('b', '', fila.titulo || fila.nombre));
    const sub = sec.resumen ? sec.resumen(fila) : '';
    if (sub) txt.appendChild(_piEl('small', '', sub));
    if (!fila.activo) txt.appendChild(_piEl('span', 'pi-badge', 'Oculto'));
    item.appendChild(txt);

    const acts = _piEl('div', 'pi-item-actions');
    acts.appendChild(_piIconBtn('Subir', '<path d="m18 15-6-6-6 6"/>', i === 0, () => _piMover(sec, i, -1)));
    acts.appendChild(_piIconBtn('Bajar', '<path d="m6 9 6 6 6-6"/>', i === PiState.filas.length - 1, () => _piMover(sec, i, 1)));
    acts.appendChild(_piIconBtn(fila.activo ? 'Ocultar' : 'Mostrar',
      fila.activo
        ? '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
        : '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
      false, () => _piGuardarFila(sec, { id: fila.id, activo: !fila.activo }, fila.activo ? 'Oculto en el inicio' : 'Visible en el inicio')));
    acts.appendChild(_piIconBtn('Editar', '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>', false, () => _piAbrirEditor(sec, fila)));
    acts.appendChild(_piIconBtn('Eliminar', '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', false, () => _piEliminar(sec, fila)));
    item.appendChild(acts);
    list.appendChild(item);
  });
  body.appendChild(list);
}

function _piIconBtn(label, paths, disabled, onClick) {
  const b = _piEl('button', 'btn ghost icon-only');
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.disabled = !!disabled;
  b.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  b.onclick = onClick;
  return b;
}

async function _piGuardarFila(sec, fila, mensaje) {
  showLoading('Guardando…');
  try {
    await ApiAdmin.saveInicio(sec.tabla, fila);
    toast(mensaje || 'Guardado');
    closePiSheet();
    await _piCargarSeccion();
  } catch (e) {
    toast('Error al guardar: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

async function _piMover(sec, i, delta) {
  const j = i + delta;
  if (j < 0 || j >= PiState.filas.length) return;
  const orden = PiState.filas.slice();
  [orden[i], orden[j]] = [orden[j], orden[i]];
  const cambios = orden
    .map((f, idx) => ({ id: f.id, orden: idx + 1, antes: f.orden }))
    .filter(c => c.orden !== c.antes);
  showLoading('Ordenando…');
  try {
    for (const c of cambios) await ApiAdmin.saveInicio(sec.tabla, { id: c.id, orden: c.orden });
    await _piCargarSeccion();
  } catch (e) {
    toast('Error al ordenar: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

async function _piEliminar(sec, fila) {
  const nombre = fila.titulo || fila.nombre || '';
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.\nSi solo querés que no se vea, usá "Ocultar".`)) return;
  showLoading('Eliminando…');
  try {
    await ApiAdmin.deleteInicio(sec.tabla, fila.id);
    toast('Eliminado');
    await _piCargarSeccion();
  } catch (e) {
    toast('Error al eliminar: ' + (e.message || ''));
  } finally {
    hideLoading();
  }
}

// ── Editor (bottom-sheet) ──
function _piAbrirEditor(sec, fila) {
  const esNuevo = !fila.id;
  document.getElementById('piSheetTitle').textContent = (esNuevo ? 'Nuevo ' : 'Editar ') + sec.singular;
  const holder = document.getElementById('piSheetForm');
  holder.innerHTML = '';

  const form = _piBuildForm(sec.campos, fila);
  const actions = _piEl('div', 'actions');
  const cancel = _piEl('button', 'btn ghost', 'Cancelar');
  cancel.type = 'button';
  cancel.onclick = closePiSheet;
  const save = _piEl('button', 'btn primary', esNuevo ? 'Agregar' : 'Guardar');
  save.type = 'submit';
  actions.appendChild(cancel);
  actions.appendChild(save);
  form.el.appendChild(actions);

  form.el.onsubmit = (ev) => {
    ev.preventDefault();
    const datos = form.leer();
    if (!datos) return;
    const payload = { ...sec.nuevo, ...datos };
    if (fila.id) payload.id = fila.id;
    else payload.orden = PiState.filas.reduce((m, f) => Math.max(m, f.orden || 0), 0) + 1;
    _piGuardarFila(sec, payload, esNuevo ? 'Agregado' : 'Cambios guardados');
  };

  holder.appendChild(form.el);
  const sheet = document.getElementById('piSheet');
  sheet.classList.add('show');
  sheet.setAttribute('aria-hidden', 'false');
  const first = holder.querySelector('input, textarea, select');
  if (first) setTimeout(() => first.focus(), 150);
}

function closePiSheet() {
  const sheet = document.getElementById('piSheet');
  if (!sheet) return;
  sheet.classList.remove('show');
  sheet.setAttribute('aria-hidden', 'true');
}

// ── Constructor de formularios ──
let _piFieldSeq = 0;

function _piBuildForm(campos, valores) {
  const el = document.createElement('form');
  el.noValidate = true;
  const lectores = [];

  campos.forEach(c => {
    const id = 'pi-f-' + (++_piFieldSeq);
    const field = _piEl('div', 'field pi-field');
    const label = _piEl('label', 'field-label', c.label + (c.req ? ' *' : ''));
    label.htmlFor = id;
    field.appendChild(label);
    const v = valores ? valores[c.k] : null;
    let leer;

    if (c.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.id = id; ta.rows = c.rows || 3; ta.value = v || '';
      if (c.max) ta.maxLength = c.max;
      field.appendChild(ta);
      leer = () => ta.value.trim();
    } else if (c.type === 'select') {
      const sel = document.createElement('select');
      sel.id = id;
      c.opciones.forEach(([val, txt]) => {
        const o = document.createElement('option');
        o.value = val; o.textContent = txt;
        sel.appendChild(o);
      });
      sel.value = v || c.opciones[0][0];
      field.appendChild(sel);
      leer = () => sel.value;
    } else if (c.type === 'datetime') {
      const inp = document.createElement('input');
      inp.id = id; inp.type = 'datetime-local'; inp.value = _piIsoALocal(v);
      field.appendChild(inp);
      leer = () => (inp.value ? new Date(inp.value).toISOString() : null);
    } else if (c.type === 'number') {
      const inp = document.createElement('input');
      inp.id = id; inp.type = 'text'; inp.inputMode = 'numeric';
      inp.value = (v === null || v === undefined) ? '' : String(Math.round(Number(v)));
      if (c.placeholder) inp.placeholder = c.placeholder;
      field.appendChild(inp);
      leer = () => {
        const n = inp.value.replace(/\D/g, '');
        return n ? Number(n) : null;
      };
    } else if (c.type === 'tags') {
      const inp = document.createElement('input');
      inp.id = id; inp.type = 'text'; inp.value = Array.isArray(v) ? v.join(', ') : '';
      field.appendChild(inp);
      leer = () => inp.value.split(',').map(t => t.trim()).filter(Boolean);
    } else if (c.type === 'image') {
      leer = _piCampoImagen(field, id, c, v);
    } else if (c.type === 'horarios') {
      leer = _piCampoHorarios(field, v);
    } else {
      const inp = document.createElement('input');
      inp.id = id;
      inp.type = c.type === 'email' ? 'email' : (c.type === 'tel' ? 'tel' : 'text');
      if (c.type === 'tel') inp.inputMode = 'numeric';
      inp.value = v || '';
      if (c.max) inp.maxLength = c.max;
      if (c.placeholder) inp.placeholder = c.placeholder;
      field.appendChild(inp);
      leer = () => inp.value.trim();
    }

    if (c.hint) field.appendChild(_piEl('span', 'field-hint', c.hint));
    el.appendChild(field);
    lectores.push({ c, leer, field });
  });

  return {
    el,
    leer() {
      const datos = {};
      let faltan = false;
      let correoMal = false;
      lectores.forEach(({ c, leer, field }) => {
        let val = leer();
        if (c.type === 'tel' && val) val = String(val).replace(/\D/g, '');
        const vacio = val === '' || val === null || (Array.isArray(val) && !val.length && c.type !== 'tags' && c.type !== 'horarios');
        const emailInvalido = c.type === 'email' && !vacio && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        const input = field.querySelector('input, textarea, select');
        if (c.req && vacio) faltan = true;
        if (emailInvalido) correoMal = true;
        if (input) markField(input, (c.req && vacio) || emailInvalido);
        datos[c.k] = (val === '' ? null : val);
      });
      if (faltan) { toast('Completá los campos obligatorios'); return null; }
      if (correoMal) { toast('Revisá el correo: no parece válido'); return null; }
      if (datos.visible_desde && datos.visible_hasta && datos.visible_hasta <= datos.visible_desde) {
        toast('"Mostrar hasta" tiene que ser posterior a "Mostrar desde"');
        return null;
      }
      return datos;
    }
  };
}

function _piCampoImagen(field, id, c, valorInicial) {
  let url = valorInicial || null;
  const wrap = _piEl('div', 'pi-image');
  const prev = _piEl('div', 'pi-image-preview');
  const btns = _piEl('div', 'pi-image-btns');
  const file = document.createElement('input');
  file.type = 'file'; file.accept = 'image/*'; file.id = id; file.hidden = true;
  const pick = _piEl('label', 'btn ghost', 'Elegir foto');
  pick.htmlFor = id;
  const quitar = _piEl('button', 'btn ghost', 'Quitar');
  quitar.type = 'button';

  const pintar = () => {
    prev.style.backgroundImage = url ? `url("${encodeURI(url)}")` : '';
    prev.classList.toggle('empty', !url);
    prev.textContent = url ? '' : 'Sin foto';
    quitar.hidden = !url;
    pick.textContent = url ? 'Cambiar foto' : 'Elegir foto';
  };

  file.onchange = async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    showLoading('Subiendo foto…');
    try {
      url = await ApiAdmin.subirImagenInicio(f, c.carpeta || 'otros', c.maxLado || 1600);
      pintar();
      toast('Foto lista. Acordate de guardar.');
    } catch (e) {
      toast('No se pudo subir la foto: ' + (e.message || ''));
    } finally {
      hideLoading();
    }
  };
  quitar.onclick = () => { url = null; pintar(); };

  btns.appendChild(pick);
  btns.appendChild(quitar);
  wrap.appendChild(prev);
  wrap.appendChild(btns);
  wrap.appendChild(file);
  field.appendChild(wrap);
  pintar();
  return () => url;
}

function _piCampoHorarios(field, valorInicial) {
  const box = _piEl('div', 'pi-horarios');
  const filas = [];

  const agregar = (h) => {
    const row = _piEl('div', 'pi-horario-row');
    const dia = document.createElement('input');
    dia.type = 'text'; dia.placeholder = 'Ej.: Lunes a viernes'; dia.value = (h && h.dia) || '';
    dia.setAttribute('aria-label', 'Días');
    const hora = document.createElement('input');
    hora.type = 'text'; hora.placeholder = 'Ej.: 08:00 – 18:00'; hora.value = (h && h.hora) || '';
    hora.setAttribute('aria-label', 'Horario');
    const del = _piIconBtn('Quitar horario', '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', false, () => {
      row.remove();
      filas.splice(filas.indexOf(par), 1);
    });
    const par = { dia, hora };
    filas.push(par);
    row.appendChild(dia); row.appendChild(hora); row.appendChild(del);
    box.insertBefore(row, addBtn);
  };

  const addBtn = _piEl('button', 'btn ghost pi-horario-add', '+ Agregar horario');
  addBtn.type = 'button';
  addBtn.onclick = () => agregar(null);
  box.appendChild(addBtn);
  (Array.isArray(valorInicial) ? valorInicial : []).forEach(agregar);
  field.appendChild(box);

  return () => filas
    .map(f => ({ dia: f.dia.value.trim(), hora: f.hora.value.trim() }))
    .filter(f => f.dia || f.hora);
}

// ── Helpers ──
function _piEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function _piIsoALocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function _piFecha(iso) {
  return new Date(iso).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function _piVigencia(r) {
  const ahora = Date.now();
  if (r.visible_hasta && new Date(r.visible_hasta).getTime() <= ahora) return 'Vencido (ya no se muestra)';
  if (r.visible_desde && new Date(r.visible_desde).getTime() > ahora) return 'Programado: desde ' + _piFecha(r.visible_desde);
  if (r.visible_hasta) return 'Se muestra hasta ' + _piFecha(r.visible_hasta);
  return 'Sin vencimiento';
}

window.goPanelInicio = goPanelInicio;
window.closePiSheet = closePiSheet;
