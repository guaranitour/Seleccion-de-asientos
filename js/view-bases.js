// ============================================================
// view-bases.js — Bases y Condiciones: landing + formulario
// ============================================================
// Inserta directo en la tabla "basesycondiciones" de Supabase con
// estado_envio = null (pendiente de procesar). El PDF/email y el estado
// final ("aceptado" / "aceptado_sin_correo") los completa un proceso
// aparte más adelante — acá solo dejamos el registro cargado.

// Controla qué sub-pantalla de view-bases está activa, para que el botón
// "volver" del header y las guardas del router sepan a dónde ir sin
// depender de leer clases .hidden del DOM.
let _basesStep = 'landing'; // 'landing' | 'form' | 'confirmed'

/** El form solo puede reabrirse directo por URL si ya se llegó a él en
 *  esta sesión (evita un GET directo mostrando un formulario "suelto"). */
function _canShowBasesForm() {
  return _basesStep === 'form' || _basesStep === 'confirmed';
}

/** La confirmación nunca es bookmarkeable: solo existe justo después de
 *  un submit exitoso, nunca por recarga o link directo. */
function _canShowBasesConfirmed() {
  return _basesStep === 'confirmed';
}

function _showBasesCard(id) {
  ['basesLanding', 'basesFormCard', 'basesConfirmedCard'].forEach(cardId => {
    const el = document.getElementById(cardId);
    if (el) el.classList.toggle('hidden', cardId !== id);
  });
}

/** Muestra la pantalla 1 (landing) dentro de view-bases. */
function goBasesLanding() {
  _basesStep = 'landing';
  _showBasesCard('basesLanding');
}

/** Muestra la pantalla 2 (formulario) dentro de view-bases. */
function goBasesForm() {
  _basesStep = 'form';
  _showBasesCard('basesFormCard');
  setHash(['Bases y condiciones', 'Formulario']);
}

/** Muestra la pantalla 3 (confirmación) dentro de view-bases. */
function goBasesConfirmed() {
  _basesStep = 'confirmed';
  _showBasesCard('basesConfirmedCard');
  setHash(['Bases y condiciones', 'Confirmacion']);
}

function _toggleBasesEmailField() {
  const checked = document.getElementById('basesTieneCorreo').checked;
  const wrap = document.getElementById('basesEmailWrap');
  const emailInput = document.getElementById('basesEmail');
  if (wrap) wrap.classList.toggle('hidden', !checked);
  if (!checked && emailInput) {
    emailInput.value = '';
    markField(emailInput, false);
  }
}

function _isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Valida y envía el formulario: insert directo en Supabase. */
async function submitBasesForm(ev) {
  ev.preventDefault();
  if (AppState.busy) return false;

  const nombreEl = document.getElementById('basesNombre');
  const ciEl = document.getElementById('basesCi');
  const tieneCorreoEl = document.getElementById('basesTieneCorreo');
  const emailEl = document.getElementById('basesEmail');
  const confirmLeidoEl = document.getElementById('basesConfirmLeido');
  const confirmLeidoRow = document.getElementById('basesConfirmLeidoRow');

  const nombre = nombreEl.value.trim();
  const ci = ciEl.value.trim();
  const tieneCorreo = tieneCorreoEl.checked;
  const email = emailEl.value.trim();
  const leyoBases = confirmLeidoEl.checked;

  let ok = true;
  if (!nombre) { markField(nombreEl, true); ok = false; } else { markField(nombreEl, false); }
  if (!ci) { markField(ciEl, true); ok = false; } else { markField(ciEl, false); }
  if (tieneCorreo) {
    if (!_isValidEmail(email)) { markField(emailEl, true); ok = false; }
    else { markField(emailEl, false); }
  }
  if (!leyoBases) {
    confirmLeidoRow.classList.add('field-error-row');
    ok = false;
  } else {
    confirmLeidoRow.classList.remove('field-error-row');
  }

  if (!ok) {
    toast(!leyoBases && nombre && ci ? 'Tenés que confirmar que leíste las Bases y Condiciones' : 'Revisá los datos marcados en rojo');
    return false;
  }

  const btn = document.getElementById('basesSubmitBtn');
  AppState.busy = true;
  if (btn) btn.disabled = true;
  showLoading('Enviando…');

  try {
    await Api.aceptarBasesYCondiciones({
      nombre,
      ci,
      email_disponible: tieneCorreo ? 'SI' : 'NO',
      email: tieneCorreo ? email : null
    });

    _setBasesConfirmedEmailNotice(tieneCorreo);
    goBasesConfirmed();
  } catch (err) {
    console.error(err);
    toast('No se pudo enviar. Probá de nuevo en un momento.');
  } finally {
    AppState.busy = false;
    if (btn) btn.disabled = false;
    hideLoading();
  }

  return false;
}

/** Ajusta el texto del aviso de correo en la confirmación según si la
 *  persona cargó email o no (sin correo, no tiene sentido decirle que
 *  "revise su bandeja de entrada"). */
function _setBasesConfirmedEmailNotice(tieneCorreo) {
  const textEl = document.getElementById('basesConfirmedEmailText');
  if (!textEl) return;
  textEl.textContent = tieneCorreo
    ? 'Te enviamos un correo con la información registrada para que tengas una copia. Si no lo recibiste, o ingresaste un correo incorrecto, contactá a tu agente e indicale que completaste la aceptación, así podrá facilitarte el PDF por WhatsApp.'
    : 'Como no registraste un correo, contactá a tu agente e indicale que completaste la aceptación: así podrá facilitarte el PDF por WhatsApp.';
}

/** Resetea el formulario a su estado inicial (se llama al volver a la landing). */
function _resetBasesForm() {
  const form = document.getElementById('basesFormCard');
  if (!form) return;
  form.reset();
  ['basesNombre', 'basesCi', 'basesEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) markField(el, false);
  });
  const confirmLeidoRow = document.getElementById('basesConfirmLeidoRow');
  if (confirmLeidoRow) confirmLeidoRow.classList.remove('field-error-row');
  _toggleBasesEmailField();
}

function _clearBasesConfirmError() {
  const row = document.getElementById('basesConfirmLeidoRow');
  if (row) row.classList.remove('field-error-row');
}

/** Botón "volver" del header: en el formulario vuelve a la landing de
 *  esta misma view; en la landing o ya confirmado, sale a Reservas (no
 *  tiene sentido reabrir el formulario después de haber aceptado). */
function _basesGoBack() {
  if (_basesStep === 'form') {
    goBasesLanding();
    setHash(['Bases y condiciones']);
    if (typeof _resetBasesForm === 'function') _resetBasesForm();
  } else {
    backToChoose();
  }
}

window.goBasesLanding = goBasesLanding;
window.goBasesForm = goBasesForm;
window.goBasesConfirmed = goBasesConfirmed;
window._canShowBasesForm = _canShowBasesForm;
window._canShowBasesConfirmed = _canShowBasesConfirmed;
window.submitBasesForm = submitBasesForm;
window._toggleBasesEmailField = _toggleBasesEmailField;
window._basesGoBack = _basesGoBack;
window._clearBasesConfirmError = _clearBasesConfirmError;
