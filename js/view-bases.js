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
let _basesStep = 'landing'; // 'landing' | 'choice' | 'form' | 'confirmed'

// Elección hecha en el paso "¿Tenés correo?" (true/false/null). Vive acá
// en vez de leerse de un checkbox del formulario: la pregunta ahora es su
// propio paso obligatorio, previo al formulario, no un campo opcional
// dentro de él.
let _basesTieneCorreo = null;

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
  ['basesLanding', 'basesChoiceCard', 'basesFormCard', 'basesConfirmedCard'].forEach(cardId => {
    const el = document.getElementById(cardId);
    if (el) el.classList.toggle('hidden', cardId !== id);
  });
}

/** Muestra la pantalla 1 (landing) dentro de view-bases. */
function goBasesLanding() {
  _basesStep = 'landing';
  _showBasesCard('basesLanding');
}

/** Muestra la pantalla 2 (¿tenés correo?) dentro de view-bases. */
function goBasesChoice() {
  _basesStep = 'choice';
  _showBasesCard('basesChoiceCard');
}

/** Se llama al tocar "Sí, tengo correo" / "No tengo correo" en el paso 2.
 *  Guarda la elección y avanza al formulario ya configurado según eso:
 *  con el campo de email visible y obligatorio, o con el aviso de "sin
 *  correo" en su lugar. */
function chooseTieneCorreo(tieneCorreo) {
  _basesTieneCorreo = !!tieneCorreo;
  const emailWrap = document.getElementById('basesEmailWrap');
  const emailInput = document.getElementById('basesEmail');
  const noCorreoNotice = document.getElementById('basesNoCorreoNotice');

  if (emailWrap) emailWrap.classList.toggle('hidden', !_basesTieneCorreo);
  if (noCorreoNotice) noCorreoNotice.classList.toggle('hidden', _basesTieneCorreo);
  if (!_basesTieneCorreo && emailInput) {
    emailInput.value = '';
    markField(emailInput, false);
  }

  goBasesForm();
}

/** Muestra la pantalla 3 (formulario) dentro de view-bases. */
function goBasesForm() {
  _basesStep = 'form';
  _showBasesCard('basesFormCard');
  setHash(['Bases y condiciones', 'Formulario']);
}

/** Muestra la pantalla 4 (confirmación) dentro de view-bases. */
function goBasesConfirmed() {
  _basesStep = 'confirmed';
  _showBasesCard('basesConfirmedCard');
  setHash(['Bases y condiciones', 'Confirmacion']);
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
  const emailEl = document.getElementById('basesEmail');
  const confirmLeidoEl = document.getElementById('basesConfirmLeido');
  const confirmLeidoRow = document.getElementById('basesConfirmLeidoRow');

  const nombre = nombreEl.value.trim();
  const ci = ciEl.value.trim();
  // La elección de "¿tenés correo?" ya se hizo en el paso anterior
  // (chooseTieneCorreo). Si por algún motivo se llega acá sin haberla
  // hecho (ej. navegación directa), tratamos como "no" por seguridad.
  const tieneCorreo = _basesTieneCorreo === true;
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
  _basesTieneCorreo = null;
  const emailWrap = document.getElementById('basesEmailWrap');
  const noCorreoNotice = document.getElementById('basesNoCorreoNotice');
  if (emailWrap) emailWrap.classList.add('hidden');
  if (noCorreoNotice) noCorreoNotice.classList.add('hidden');
}

function _clearBasesConfirmError() {
  const row = document.getElementById('basesConfirmLeidoRow');
  if (row) row.classList.remove('field-error-row');
}

/** Botón "volver" del header: en el formulario vuelve al paso "¿tenés
 *  correo?"; en ese paso vuelve a la landing; en la landing o ya
 *  confirmado, sale a Reservas (no tiene sentido reabrir el flujo
 *  después de haber aceptado). */
function _basesGoBack() {
  if (_basesStep === 'form') {
    goBasesChoice();
    setHash(['Bases y condiciones']);
  } else if (_basesStep === 'choice') {
    goBasesLanding();
    setHash(['Bases y condiciones']);
    if (typeof _resetBasesForm === 'function') _resetBasesForm();
  } else {
    backToChoose();
  }
}

window.goBasesLanding = goBasesLanding;
window.goBasesChoice = goBasesChoice;
window.chooseTieneCorreo = chooseTieneCorreo;
window.goBasesForm = goBasesForm;
window.goBasesConfirmed = goBasesConfirmed;
window._canShowBasesForm = _canShowBasesForm;
window._canShowBasesConfirmed = _canShowBasesConfirmed;
window.submitBasesForm = submitBasesForm;
window._basesGoBack = _basesGoBack;
window._clearBasesConfirmError = _clearBasesConfirmError;
