// ============================================================
// auth.js — Login Google (Supabase Auth), resolución de rol,
// guard de acceso al panel staff/admin.
// ============================================================

const Auth = {
  user: null,   // { id, email }
  role: null,   // 'staff' | 'admin' | null (no autorizado)

  async init() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      await this._resolveRole(data.session.user);
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await this._resolveRole(session.user);
        onAuthReady();
      } else if (event === 'SIGNED_OUT') {
        this.user = null;
        this.role = null;
        onAuthReady();
      }
    });
  },

  async _resolveRole(user) {
    this.user = { id: user.id, email: user.email };

    // 1) Buscar por user_id (caso normal: ya logueó antes al menos una vez).
    let { data, error } = await supabase
      .from('staff')
      .select('role, user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    // 2) Si no hay fila por user_id, puede que el admin haya dado de alta
    //    a la persona solo por email (todavía sin user_id). En ese caso
    //    la buscamos por email y "reclamamos" la fila completando el
    //    user_id, para que a partir de ahora quede vinculada a esa cuenta.
    if (!error && !data) {
      const byEmail = await supabase
        .from('staff')
        .select('role, user_id, email')
        .eq('email', user.email)
        .is('user_id', null)
        .maybeSingle();

      if (!byEmail.error && byEmail.data) {
        const claim = await supabase
          .from('staff')
          .update({ user_id: user.id })
          .eq('email', user.email)
          .is('user_id', null)
          .select('role')
          .maybeSingle();

        if (!claim.error && claim.data) {
          data = claim.data;
          error = null;
        }
      }
    }

    if (error || !data) {
      this.role = null; // logueado en Google, pero no autorizado en "staff"
      return;
    }
    this.role = data.role; // 'staff' | 'admin'
  },

  isLoggedIn() { return !!this.user; },
  isAuthorized() { return !!this.role; },
  isAdmin() { return this.role === 'admin'; },

  async loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) toast('No se pudo iniciar sesión: ' + error.message);
  },

  async logout() {
    await supabase.auth.signOut();
    this.user = null;
    this.role = null;
    setHash(['Inicio']);
    showView('view-choose');
  }
};

/** Se llama cuando cambia el estado de auth (login/logout completo). */
function onAuthReady() {
  updateStaffEntryPoint();
  // Si estábamos en el panel y perdimos la sesión/autorización, sacar de ahí
  const panelActive = document.getElementById('view-panel') && document.getElementById('view-panel').classList.contains('active');
  if (panelActive && !Auth.isAuthorized()) {
    goStaffLogin();
  }
}

/** Muestra/oculta el botón de acceso staff según sesión. */
function updateStaffEntryPoint() {
  const btn = document.getElementById('staffEntryBtn');
  if (!btn) return;
  if (Auth.isAuthorized()) {
    btn.textContent = Auth.isAdmin() ? '⚙ Panel admin' : '⚙ Panel staff';
  } else {
    btn.textContent = '⚙ Acceso staff';
  }
}

/** Punto de entrada al panel — pide login si hace falta. */
async function goStaffLogin() {
  showView('view-staff-login');

  const loginCard  = document.getElementById('staffLoginCard');
  const deniedCard = document.getElementById('staffDeniedCard');

  if (Auth.isLoggedIn() && !Auth.isAuthorized()) {
    // Logueado en Google pero sin fila en "staff": tarjeta de acceso
    // denegado dedicada, en vez de reusar el texto del login normal.
    loginCard.style.display  = 'none';
    deniedCard.style.display = '';
    document.getElementById('staffDeniedMsg').textContent =
      `La cuenta ${Auth.user.email} no tiene permisos para ingresar al panel staff.`;
    return;
  }

  deniedCard.style.display = 'none';
  loginCard.style.display  = '';

  if (Auth.isAuthorized()) {
    goPanel();
    return;
  }

  document.getElementById('staffLoginMsg').textContent = 'Iniciá sesión con tu cuenta de Google autorizada.';
}

window.Auth = Auth;
window.onAuthReady = onAuthReady;
window.updateStaffEntryPoint = updateStaffEntryPoint;
window.goStaffLogin = goStaffLogin;
