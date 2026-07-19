// ============================================================
// view-reserve.js — Formulario de reserva + confirmación + confeti
// ============================================================

function _seatSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 10V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>
    <path d="M5 10a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2H5z"/>
    <path d="M7 18v2M17 18v2"/><path d="M5 14v4h14v-4"/>
  </svg>`;
}

function _checkSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6L9 17l-5-5"/>
  </svg>`;
}

function startSelectionPage() {
  if (AppState.busy) return;
  if (!AppState.selected || AppState.selected.size === 0) { toast('Elegí al menos un asiento'); return; }
  showView('view-reserve');
  renderReservePage();
  setHash(['Formulario', AppState.viaje.nombre]);
}

function backToSelect() {
  showView('view-select');
}

/** Renderiza el formulario de datos del/los pasajero(s). */
function renderReservePage() {
  const body = document.getElementById('reservePageBody');
  const title = document.getElementById('reservePageTitle');
  if (!body) return;
  if (title) title.style.display = 'none';

  body.innerHTML = '';
  const seats = Array.from(AppState.selected);
  const single = seats.length === 1;
  const tripName = AppState.viaje ? AppState.viaje.nombre : '';

  const wrap = document.createElement('div');
  wrap.className = 'reserve-wrap';
  wrap.innerHTML = `
    <div class="reserve-header">
      <div class="reserve-eyebrow">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${tripName ? tripName + ' &mdash; ' : ''}${single ? '1 asiento' : seats.length + ' asientos'}
      </div>
      <h2 class="reserve-title">${single ? 'Datos del pasajero' : 'Datos de los pasajeros'}</h2>
      <p class="reserve-subtitle">${single
        ? 'Completá tu nombre y número de documento para confirmar el asiento.'
        : 'Completá los datos de cada pasajero para confirmar los asientos.'}</p>
    </div>`;

  seats.forEach(s => {
    const norm = normalize(s);
    const num = AppState.numLabels.get(norm) || norm;
    const nameInputId = single ? 'singleName' : '';
    const ciInputId = single ? 'singleCI' : '';

    const card = document.createElement('div');
    card.className = 'reserve-card';
    card.dataset.code = norm;
    card.innerHTML = `
      <div class="reserve-card-header">
        <div class="reserve-seat-badge">${_seatSvg()}</div>
        <div>
          <div class="reserve-seat-label">Asiento ${num}</div>
          <div class="reserve-seat-sub">Completá los datos del pasajero</div>
        </div>
      </div>
      <div class="reserve-fields">
        <label class="reserve-field">
          <span class="reserve-field-label">Nombre y Apellido</span>
          <div class="reserve-autocomplete-wrap">
            <input class="${single ? '' : 'assign-name'}" id="${nameInputId}"
              type="text" placeholder="Ej.: María González"
              autocapitalize="words" autocomplete="off" autocorrect="off"/>
            <div class="reserve-autocomplete-list" hidden></div>
          </div>
        </label>
        <label class="reserve-field">
          <span class="reserve-field-label">Documento</span>
          <input class="${single ? '' : 'assign-ci'}" id="${ciInputId}"
            type="text" placeholder="Ej.: 12345678"
            inputmode="numeric" pattern="[0-9]*"/>
        </label>
      </div>`;

    const ciInput = card.querySelector(single ? '#singleCI' : '.assign-ci');
    if (ciInput) ciInput.addEventListener('input', function () { onlyDigits(this); });

    // Autocomplete contra la base de clientes: exclusivo para staff logueado.
    // Un visitante anónimo nunca ve ni dispara esta búsqueda — el input
    // sigue siendo un campo de texto libre común y corriente para él.
    if (Auth.isAuthorized()) {
      const nameInput = card.querySelector(single ? '#singleName' : '.assign-name');
      _wirePassengerAutocomplete(nameInput, ciInput);
    }

    wrap.appendChild(card);
  });

  body.appendChild(wrap);

  const oldActions = document.querySelector('#view-reserve .actions:not(.reserve-actions)');
  if (oldActions) {
    oldActions.classList.add('reserve-actions');
    wrap.appendChild(oldActions);
  }

  requestAnimationFrame(() => {
    const first = body.querySelector('input');
    if (first) try { first.focus(); } catch (_) {}
  });
}

/**
 * Conecta un input de nombre a la búsqueda en public.pasajeros y muestra
 * un desplegable de sugerencias. Al elegir una, completa nombre + CI.
 * Debounce de 300ms para no disparar una consulta por cada tecla.
 */
function _wirePassengerAutocomplete(nameInput, ciInput) {
  if (!nameInput) return;
  const wrap = nameInput.closest('.reserve-autocomplete-wrap');
  const list = wrap ? wrap.querySelector('.reserve-autocomplete-list') : null;
  if (!list) return;

  let debounceTimer = null;
  let activeIndex = -1;
  let currentResults = [];

  function closeList() {
    list.hidden = true;
    list.innerHTML = '';
    activeIndex = -1;
    currentResults = [];
  }

  function pick(item) {
    nameInput.value = item['Pasajero'] || '';
    if (ciInput) {
      ciInput.value = item['Documento de Identidad'] || '';
      onlyDigits(ciInput);
    }
    closeList();
    markField(nameInput, false);
    if (ciInput) markField(ciInput, false);
  }

  function renderList(items) {
    currentResults = items;
    activeIndex = -1;
    if (!items.length) { closeList(); return; }

    list.innerHTML = items.map((item, i) => `
      <button type="button" class="reserve-autocomplete-item" data-idx="${i}">
        <span class="reserve-autocomplete-name">${item['Pasajero'] || ''}</span>
        <span class="reserve-autocomplete-ci">${item['Documento de Identidad'] || ''}</span>
      </button>`).join('');
    list.hidden = false;

    list.querySelectorAll('.reserve-autocomplete-item').forEach(btn => {
      // mousedown en vez de click: dispara antes del blur del input,
      // así el valor se completa antes de que el dropdown se cierre por blur
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = Number(btn.dataset.idx);
        pick(currentResults[idx]);
      });
    });
  }

  nameInput.addEventListener('input', function () {
    const q = this.value;
    clearTimeout(debounceTimer);
    if (q.trim().length < 3) { closeList(); return; }

    debounceTimer = setTimeout(async () => {
      try {
        const results = await Api.buscarPasajeros(q);
        renderList(results);
      } catch (e) {
        console.error(e);
        closeList();
      }
    }, 300);
  });

  nameInput.addEventListener('keydown', function (e) {
    if (list.hidden || !currentResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
      _highlightAutocompleteItem(list, activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      _highlightAutocompleteItem(list, activeIndex);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(currentResults[activeIndex]);
    } else if (e.key === 'Escape') {
      closeList();
    }
  });

  nameInput.addEventListener('blur', function () {
    // pequeño delay para permitir que el mousedown del item procese primero
    setTimeout(closeList, 120);
  });
}

function _highlightAutocompleteItem(list, activeIndex) {
  list.querySelectorAll('.reserve-autocomplete-item').forEach((el, i) => {
    el.classList.toggle('active', i === activeIndex);
  });
}

/** Valida el formulario, reserva vía RPC y muestra confirmación. */
async function confirmReservationPage() {
  if (AppState.busy) return;

  let pairs = [];
  let firstInvalid = null;

  if (AppState.selected.size === 1) {
    const nameEl = document.getElementById('singleName');
    const ciEl = document.getElementById('singleCI');
    const name = nameEl ? nameEl.value.trim() : '';
    const ci = ciEl ? ciEl.value.trim() : '';

    markField(nameEl, !name);
    markField(ciEl, !ci);

    if (!name || !ci) {
      firstInvalid = !name ? nameEl : ciEl;
      toast('Completá nombre y documento para confirmar');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
    pairs.push({ code: normalize([...AppState.selected][0]), pasajero: name, ci });

  } else {
    const cards = document.querySelectorAll('#reservePageBody .reserve-card[data-code]');
    let invalid = false;

    cards.forEach(card => {
      const nameEl = card.querySelector('.assign-name');
      const ciEl = card.querySelector('.assign-ci');
      const name = nameEl ? nameEl.value.trim() : '';
      const ci = ciEl ? ciEl.value.trim() : '';

      markField(nameEl, !name);
      markField(ciEl, !ci);

      if (!name || !ci) {
        invalid = true;
        if (!firstInvalid) firstInvalid = !name ? nameEl : ciEl;
      }
      pairs.push({ code: card.dataset.code, pasajero: name, ci });
    });

    if (invalid) {
      toast('Completá los datos de todos los pasajeros antes de confirmar');
      if (firstInvalid) firstInvalid.focus();
      return;
    }
  }

  AppState.busy = true;
  showLoading('Reservando…');

  try {
    await Api.reservarAsientos(AppState.planta.id, pairs);
    renderConfirmedPage(pairs);
    showView('view-confirmed');
    AppState.selected = new Set();
  } catch (e) {
    console.error(e);
    toast(e && e.message ? e.message : 'No se pudo reservar. Puede que alguien más haya tomado ese asiento.');
    // Recargar para reflejar el estado real (por si el error fue "ya no está libre")
    await refreshSeats('grid-select', { hideMissing: true });
  } finally {
    AppState.busy = false;
    hideLoading();
  }
}

/** Renderiza la pantalla de confirmación + lanza confeti. */
function renderConfirmedPage(pairs) {
  const body = document.getElementById('confirmedPageBody');
  if (!body) return;
  body.innerHTML = '';

  const tripName = AppState.viaje ? AppState.viaje.nombre : '';

  const wrap = document.createElement('div');
  wrap.className = 'confirmed-wrap';

  const header = document.createElement('div');
  header.innerHTML = `
    <div class="confirmed-icon-wrap">
      <div class="confirmed-ring"></div>
      <div class="confirmed-check">${_checkSvg()}</div>
    </div>
    <h2 class="confirmed-title">¡Reserva confirmada!</h2>`;
  wrap.appendChild(header);

  const list = document.createElement('div');
  list.className = 'confirmed-list';
  pairs.forEach(p => {
    const num = AppState.numLabels.get(p.code) || p.code;
    const card = document.createElement('div');
    card.className = 'confirmed-card';
    card.innerHTML = `
      <div class="confirmed-card-icon">${_checkSvg()}</div>
      <div class="confirmed-card-info">
        <div class="confirmed-card-num">Asiento ${num}</div>
        <div class="confirmed-card-name">${p.pasajero || '—'}</div>
      </div>`;
    list.appendChild(card);
  });
  wrap.appendChild(list);

  const hint = document.createElement('div');
  hint.className = 'confirmed-hint';
  hint.textContent = '📲 Tocá "Compartir reserva" para guardar tu comprobante';
  wrap.appendChild(hint);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'confirmed-actions';

  // Antes esto solo aparecía si navigator.share existía (compartía texto
  // plano). Ahora genera una imagen de la tarjeta: comparte el archivo si
  // el navegador lo soporta, y si no, la descarga directamente — así el
  // botón es útil en cualquier navegador, no solo los que tienen Web Share.
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'btn success';
  shareBtn.innerHTML = '↑ Compartir reserva';
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    const originalLabel = shareBtn.innerHTML;
    shareBtn.innerHTML = 'Generando imagen…';
    try {
      await shareOrDownloadConfirmedCard(pairs);
    } finally {
      shareBtn.disabled = false;
      shareBtn.innerHTML = originalLabel;
    }
  });
  actionsDiv.appendChild(shareBtn);

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'btn primary';
  backBtn.textContent = 'Volver al inicio';
  backBtn.addEventListener('click', () => backToChoose());
  actionsDiv.appendChild(backBtn);

  wrap.appendChild(actionsDiv);
  body.appendChild(wrap);

  _launchConfetti();
}

function _launchConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.width = window.innerWidth;
  const H = canvas.height = window.innerHeight;
  const colors = ['#2c7be5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const pieces = [];
  const total = 110;
  let alive = true;

  for (let i = 0; i < total; i++) {
    pieces.push({
      x: Math.random() * W, y: -10 - Math.random() * 60,
      r: 4 + Math.random() * 5, color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - .5) * 3, vy: 2.5 + Math.random() * 3.5,
      spin: (Math.random() - .5) * .18, angle: Math.random() * Math.PI * 2,
      shape: Math.random() > .5 ? 'rect' : 'circle', alpha: 1
    });
  }

  let frame;
  function draw() {
    if (!alive) return;
    ctx.clearRect(0, 0, W, H);
    let allDone = true;
    pieces.forEach(p => {
      if (p.y < H + 20) allDone = false;
      p.x += p.vx; p.y += p.vy; p.angle += p.spin; p.vy *= 1.012;
      if (p.y > H * .7) p.alpha = Math.max(0, p.alpha - .018);

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.r, -p.r * .5, p.r * 2, p.r);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r * .7, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    if (allDone) { alive = false; canvas.style.display = 'none'; return; }
    frame = requestAnimationFrame(draw);
  }

  canvas.style.display = '';
  draw();
  setTimeout(() => { alive = false; cancelAnimationFrame(frame); canvas.style.display = 'none'; }, 4000);
}

window.startSelectionPage = startSelectionPage;
window.backToSelect = backToSelect;
window.renderReservePage = renderReservePage;
window.confirmReservationPage = confirmReservationPage;
window.renderConfirmedPage = renderConfirmedPage;
