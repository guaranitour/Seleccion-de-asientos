// ============================================================
// supabase-client.js — Inicialización del cliente Supabase
// ============================================================
// Reemplaza BASE_URL / API_KEY de AppScript del prototipo viejo.
// Reutiliza el MISMO proyecto Supabase de Guarani Tour;
// todas las tablas de este módulo viven en el schema "reservas".

const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co'; // TODO: reemplazar
const SUPABASE_ANON_KEY = 'TU-ANON-KEY';                 // TODO: reemplazar

// Ojo: "createClient" viene de la librería global window.supabase (CDN).
// Una vez creado el cliente, sobreescribimos window.supabase con la
// INSTANCIA ya inicializada, para que todos los demás archivos (api.js,
// etc.) puedan usar la variable global "supabase" y que tenga
// realmente los métodos .from(), .rpc(), .channel(), etc.
const supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'reservas' }
});

window.supabase = supabaseInstance;
