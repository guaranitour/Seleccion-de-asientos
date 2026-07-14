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
    const { data, error } = await supabase
      .from('staff')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

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

  if (Auth.isLoggedIn() && !Auth.isAuthorized()) {
    document.getElementById('staffLoginMsg').textContent =
      `Tu cuenta (${Auth.user.email}) no tiene acceso al panel. Pedile a un administrador que te agregue.`;
    document.getElementById('staffLoginBtn').style.display = 'none';
    document.getElementById('staffLogoutBtn').style.display = '';
    return;
  }

  if (Auth.isAuthorized()) {
    goPanel();
    return;
  }

  document.getElementById('staffLoginMsg').textContent = 'Iniciá sesión con tu cuenta de Google autorizada.';
  document.getElementById('staffLoginBtn').style.display = '';
  document.getElementById('staffLogoutBtn').style.display = 'none';
}

window.Auth = Auth;
window.onAuthReady = onAuthReady;
window.updateStaffEntryPoint = updateStaffEntryPoint;
window.goStaffLogin = goStaffLogin;
