// ============================================================
// view-bases.js — Bases y Condiciones: landing + formulario
// ============================================================
// Inserta directo en la tabla "basesycondiciones" de Supabase con
// estado_envio = null (pendiente de procesar). El PDF/email y el estado
// final ("aceptado" / "aceptado_sin_correo") los completa un proceso
// aparte más adelante — acá solo dejamos el registro cargado.

/** Muestra la pantalla 1 (landing) dentro de view-bases. */
function goBasesLanding() {
  const landing = document.getElementById('basesLanding');
  const form = document.getElementById('basesFormCard');
  if (landing) landing.classList.remove('hidden');
  if (form) form.classList.add('hidden');
}

/** Muestra la pantalla 2 (formulario) dentro de view-bases. */
function goBasesForm() {
  const landing = document.getElementById('basesLanding');
  const form = document.getElementById('basesFormCard');
  if (landing) landing.classList.add('hidden');
  if (form) form.classList.remove('hidden');
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

  const nombre = nombreEl.value.trim();
  const ci = ciEl.value.trim();
  const tieneCorreo = tieneCorreoEl.checked;
  const email = emailEl.value.trim();

  let ok = true;
  if (!nombre) { markField(nombreEl, true); ok = false; } else { markField(nombreEl, false); }
  if (!ci) { markField(ciEl, true); ok = false; } else { markField(ciEl, false); }
  if (tieneCorreo) {
    if (!_isValidEmail(email)) { markField(emailEl, true); ok = false; }
    else { markField(emailEl, false); }
  }

  if (!ok) {
    toast('Revisá los datos marcados en rojo');
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

    toast('¡Listo! Registramos tu aceptación.');
    backToChoose();
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

/** Resetea el formulario a su estado inicial (se llama al volver a la landing). */
function _resetBasesForm() {
  const form = document.getElementById('basesFormCard');
  if (!form) return;
  form.reset();
  ['basesNombre', 'basesCi', 'basesEmail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) markField(el, false);
  });
  _toggleBasesEmailField();
}

/** Botón "volver" del header: si estás en el formulario, vuelve a la
 *  landing de esta misma view; si estás en la landing, sale a Reservas. */
function _basesGoBack() {
  const form = document.getElementById('basesFormCard');
  if (form && !form.classList.contains('hidden')) {
    goBasesLanding();
  } else {
    backToChoose();
  }
}

window.goBasesLanding = goBasesLanding;
window.goBasesForm = goBasesForm;
window.submitBasesForm = submitBasesForm;
window._toggleBasesEmailField = _toggleBasesEmailField;
window._basesGoBack = _basesGoBack;
