// ============================================================
// api-admin.js — Capa de acceso a datos del panel staff/admin
// ============================================================

const ApiAdmin = {

  /** Todos los viajes (activos e inactivos), para el panel. */
  async getAllViajes() {
    const { data, error } = await supabase
      .from('viajes')
      .select('id, nombre, tipo, start_at, activo, plantas(id, etiqueta, orden)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    (data || []).forEach(v => {
      if (Array.isArray(v.plantas)) v.plantas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });
    return data || [];
  },

  /** Crea un viaje nuevo con su estructura de asientos.
   *  Cantidad de filas fija por tipo: convencional = 11 filas;
   *  doble piso = 10 filas en planta alta, 5 en planta baja. */
  async crearViaje(nombre, tipo, startAt) {
    const { data, error } = await supabase.rpc('crear_viaje', {
      p_nombre: nombre,
      p_tipo: tipo,
      p_start_at: startAt || null,
      p_filas: 11,
      p_filas_alta: 10,
      p_filas_baja: 5
    });
    if (error) throw error;
    return data; // uuid del nuevo viaje
  },

  async setViajeActivo(viajeId, activo) {
    const { error } = await supabase.rpc('set_viaje_activo', { p_viaje_id: viajeId, p_activo: activo });
    if (error) throw error;
  },

  /** Asientos de una planta CON datos de pasajero (vía RPC: join server-side). */
  async getAsientosByPlanta(plantaId) {
    const { data, error } = await supabase.rpc('get_asientos_con_pasajero', { p_planta_id: plantaId });
    if (error) throw error;
    return data || [];
  },

  async moverPasajero(plantaId, sourceCode, targetCode) {
    const { error } = await supabase.rpc('mover_pasajero', {
      p_planta_id: plantaId, p_source_code: sourceCode, p_target_code: targetCode
    });
    if (error) throw error;
  },

  async liberarAsiento(plantaId, code) {
    const { error } = await supabase.rpc('liberar_asiento', { p_planta_id: plantaId, p_code: code });
    if (error) throw error;
  },

  async agregarFila(plantaId, fila) {
    const { error } = await supabase.rpc('agregar_fila', { p_planta_id: plantaId, p_fila: fila });
    if (error) throw error;
  },

  async eliminarFila(plantaId, fila) {
    const { error } = await supabase.rpc('eliminar_fila', { p_planta_id: plantaId, p_fila: fila });
    if (error) throw error;
  },

  async setAsientoHabilitado(asientoId, habilitado) {
    const { error } = await supabase.rpc('set_asiento_habilitado', {
      p_asiento_id: asientoId, p_habilitado: habilitado
    });
    if (error) throw error;
  },

  /** Búsqueda por CI dentro del panel (vía RPC, todas las plantas del viaje). */
  async getAsientosByCi(viajeId, ci) {
    const { data, error } = await supabase.rpc('buscar_por_ci', { p_viaje_id: viajeId, p_ci: ci });
    if (error) throw error;
    return data || [];
  }
};

window.ApiAdmin = ApiAdmin;
