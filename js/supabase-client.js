// ============================================================
// supabase-client.js — Inicialización del cliente Supabase
// ============================================================
// Reemplaza BASE_URL / API_KEY de AppScript del prototipo viejo.
// Reutiliza el MISMO proyecto Supabase de Guarani Tour;
// todas las tablas de este módulo viven en el schema "reservas".

const SUPABASE_URL = "https://pmxwpmxiemhbeliywhpj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBteHdwbXhpZW1oYmVsaXl3aHBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMDEwOTQsImV4cCI6MjA5MzU3NzA5NH0.Jhsdv_kh4JbmEh2ZmMvGqPNGjg1dYNXsYBtUyvnshxg";

// Ojo: "createClient" viene de la librería global window.supabase (CDN).
// Una vez creado el cliente, sobreescribimos window.supabase con la
// INSTANCIA ya inicializada, para que todos los demás archivos (api.js,
// etc.) puedan usar la variable global "supabase" y que tenga
// realmente los métodos .from(), .rpc(), .channel(), etc.
//
// storageKey: por defecto, Supabase guarda la sesión en localStorage
// bajo una clave fija ("sb-<project-ref>-auth-token"). Como Guarani
// Tour App y esta app viven en el mismo dominio (guaranitour.github.io)
// y usan el MISMO proyecto Supabase, sin esto ambas apps pisan la
// misma entrada de localStorage y se invalidan la sesión mutuamente.
// Con una storageKey propia, cada app tiene su sesión completamente
// independiente, aunque compartan dominio y proyecto.
const supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: { schema: 'reservas' },
  auth: { storageKey: 'sb-reservas-auth-token' }
});

window.supabase = supabaseInstance;
