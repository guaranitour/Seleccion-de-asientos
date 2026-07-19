// ============================================================
// share-card.js — Genera una imagen (PNG) de la reserva confirmada,
// dibujada en <canvas>, para compartir o descargar como comprobante.
// No depende de ningún servicio externo (Canva, etc.) — todo se
// renderiza en el navegador del pasajero.
// ============================================================

const SHARE_CARD_WIDTH = 900;
const SHARE_CARD_PADDING = 60;

/** Colores tomados de base.css para que la imagen combine con la app. */
const SHARE_CARD_COLORS = {
  bg: '#f7f9fc',
  card: '#ffffff',
  text: '#1f2937',
  muted: '#6b7280',
  success: '#10b981',
  successRingFrom: '#d1fae5',
  successRingTo: '#a7f3d0',
  border: 'rgba(17,24,39,0.08)'
};

let _logoImgPromise = null;

/** Carga (una sola vez) el logo de la app como HTMLImageElement. */
function _loadLogoImage() {
  if (_logoImgPromise) return _logoImgPromise;
  _logoImgPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sin logo, la tarjeta se genera igual
    img.src = 'Logo.png';
  });
  return _logoImgPromise;
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function _drawCheck(ctx, cx, cy, radius) {
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, SHARE_CARD_COLORS.successRingFrom);
  grad.addColorStop(1, SHARE_CARD_COLORS.successRingTo);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = SHARE_CARD_COLORS.success;
  ctx.lineWidth = radius * 0.11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - radius * 0.42, cy + radius * 0.02);
  ctx.lineTo(cx - radius * 0.08, cy + radius * 0.36);
  ctx.lineTo(cx + radius * 0.46, cy - radius * 0.32);
  ctx.stroke();
}

/** Parte un texto largo en líneas que entren en maxWidth. */
function _wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach(word => {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function _formatFecha(startAtIso) {
  if (!startAtIso) return '';
  const d = new Date(startAtIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-PY', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Dibuja la tarjeta de reserva confirmada y devuelve un Blob PNG.
 * pairs: [{ code, pasajero, ci }, ...] — igual que en renderConfirmedPage.
 */
async function buildShareCardBlob(pairs) {
  const viaje = AppState.viaje;
  const tripName = viaje ? viaje.nombre : '';
  const fechaLabel = viaje ? _formatFecha(viaje.start_at) : '';

  const logo = await _loadLogoImage();

  // Alto dinámico: crece con la cantidad de asientos.
  const rowH = 92;
  const headerH = 300;
  const footerH = 90;
  const listTop = headerH;
  const listH = pairs.length * (rowH + 14) + 20;
  const height = listTop + listH + footerH;

  const canvas = document.createElement('canvas');
  const scale = 2; // exporta a 2x para que se vea nítido en pantallas retina
  canvas.width = SHARE_CARD_WIDTH * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Fondo
  ctx.fillStyle = SHARE_CARD_COLORS.bg;
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, height);

  // Logo (centrado arriba)
  if (logo) {
    const logoH = 64;
    const logoW = logo.width * (logoH / logo.height);
    ctx.drawImage(logo, (SHARE_CARD_WIDTH - logoW) / 2, 36, logoW, logoH);
  }

  // Círculo + check
  _drawCheck(ctx, SHARE_CARD_WIDTH / 2, 176, 56);

  // Título
  ctx.fillStyle = SHARE_CARD_COLORS.text;
  ctx.font = '900 34px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('¡Reserva confirmada!', SHARE_CARD_WIDTH / 2, 262);

  // Viaje + fecha
  if (tripName || fechaLabel) {
    ctx.fillStyle = SHARE_CARD_COLORS.muted;
    ctx.font = '600 18px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const sub = [tripName, fechaLabel].filter(Boolean).join(' — ');
    ctx.fillText(sub, SHARE_CARD_WIDTH / 2, 288);
  }

  // Tarjetas de asientos
  ctx.textAlign = 'left';
  let y = listTop;
  pairs.forEach(p => {
    const num = AppState.numLabels.get(p.code) || p.code;
    const x = SHARE_CARD_PADDING;
    const w = SHARE_CARD_WIDTH - SHARE_CARD_PADDING * 2;

    ctx.fillStyle = SHARE_CARD_COLORS.card;
    _roundRect(ctx, x, y, w, rowH, 16);
    ctx.fill();
    ctx.strokeStyle = SHARE_CARD_COLORS.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ícono circular chico con check
    const iconCx = x + 44;
    const iconCy = y + rowH / 2;
    _drawCheck(ctx, iconCx, iconCy, 22);

    // Textos
    const textX = x + 90;
    ctx.fillStyle = SHARE_CARD_COLORS.muted;
    ctx.font = '700 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ASIENTO ' + num, textX, y + 36);

    ctx.fillStyle = SHARE_CARD_COLORS.text;
    ctx.font = '800 24px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const nameLines = _wrapText(ctx, p.pasajero || '—', w - 110);
    ctx.fillText(nameLines[0] || '—', textX, y + 66);

    y += rowH + 14;
  });

  // Footer
  ctx.textAlign = 'center';
  ctx.fillStyle = SHARE_CARD_COLORS.muted;
  ctx.font = '600 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Destino Guaraní', SHARE_CARD_WIDTH / 2, height - 34);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

/**
 * Comparte (si el navegador soporta compartir archivos) o descarga la
 * imagen de la reserva confirmada.
 */
async function shareOrDownloadConfirmedCard(pairs) {
  let blob;
  try {
    blob = await buildShareCardBlob(pairs);
  } catch (e) {
    console.error('shareOrDownloadConfirmedCard error:', e);
    toast('No se pudo generar la imagen');
    return;
  }
  if (!blob) { toast('No se pudo generar la imagen'); return; }

  const tripName = AppState.viaje ? AppState.viaje.nombre : 'reserva';
  const slug = tripName.trim().replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
  const filename = `reserva-${slug || 'destino-guarani'}.png`;
  const file = new File([blob], filename, { type: 'image/png' });

  const canShareFiles = navigator.canShare && navigator.canShare({ files: [file] });
  if (navigator.share && canShareFiles) {
    try {
      await navigator.share({
        files: [file],
        title: tripName ? 'Reserva ' + tripName : 'Reserva confirmada'
      });
      return;
    } catch (e) {
      // Usuario canceló el share nativo, o falló: no hacemos fallback a
      // descarga automática en ese caso para no "molestar" con una
      // descarga no pedida tras cancelar. AbortError = cancelado a propósito.
      if (e && e.name === 'AbortError') return;
      // Cualquier otro error: seguimos al fallback de descarga.
    }
  }

  _downloadBlob(blob, filename);
}

function _downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Imagen guardada');
}

window.shareOrDownloadConfirmedCard = shareOrDownloadConfirmedCard;
