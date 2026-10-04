// ============================================================
// api-admin.js — Capa de acceso a datos del panel staff/admin
// ============================================================

const ApiAdmin = {

  /** Todos los viajes (activos e inactivos), para el panel. */
  async getAllViajes() {
    const { data, error } = await supabase
      .from('viajes')
      .select('id, nombre, tipo, start_at, activo, publicado_inicio, destino_id, plantas(id, etiqueta, orden)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    (data || []).forEach(v => {
      if (Array.isArray(v.plantas)) v.plantas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    });
    return data || [];
  },

  /** Crea un viaje nuevo con su estructura de asientos. */
  async crearViaje(nombre, tipo, startAt, filas) {
    const { data, error } = await supabase.rpc('crear_viaje', {
      p_nombre: nombre,
      p_tipo: tipo,
      p_start_at: startAt || null,
      p_filas: filas
    });
    if (error) throw error;
    return data; // uuid del nuevo viaje
  },

  async setViajeActivo(viajeId, activo) {
    const { error } = await supabase.rpc('set_viaje_activo', { p_viaje_id: viajeId, p_activo: activo });
    if (error) throw error;
  },

  /**
   * Los dos interruptores de visibilidad de un viaje. Pasar null en uno lo
   * deja como está. "activo" en la tabla = selección de asientos habilitada.
   */
  async setViajeVisibilidad(viajeId, { publicadoInicio = null, seleccionHabilitada = null }) {
    const { error } = await supabase.rpc('set_viaje_visibilidad', {
      p_viaje_id: viajeId,
      p_publicado_inicio: publicadoInicio,
      p_seleccion_habilitada: seleccionHabilitada
    });
    if (error) throw error;
  },

  /** Asigna (o quita, con null) el destino de un viaje: de ahí toma su foto. */
  async setViajeDestino(viajeId, destinoId) {
    const { error } = await supabase.from('viajes').update({ destino_id: destinoId || null }).eq('id', viajeId);
    if (error) throw error;
  },

  // ── Contenido del inicio (Panel › Inicio) ──

  /** Filas de una tabla del inicio, incluidas las inactivas (RLS: staff ve todo). */
  async listInicio(tabla, filtro) {
    let q = supabase.from(tabla).select('*');
    Object.entries(filtro || {}).forEach(([k, v]) => { q = q.eq(k, v); });
    const { data, error } = await q.order('orden', { ascending: true }).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** Inserta (sin id) o actualiza (con id) una fila. Devuelve la fila guardada. */
  async saveInicio(tabla, fila) {
    const { id, created_at, ...datos } = fila;
    const q = id
      ? supabase.from(tabla).update(datos).eq('id', id)
      : supabase.from(tabla).insert(datos);
    const { data, error } = await q.select().single();
    if (error) throw error;
    return data;
  },

  async deleteInicio(tabla, id) {
    const { error } = await supabase.from(tabla).delete().eq('id', id);
    if (error) throw error;
  },

  async getInicioConfig() {
    const { data, error } = await supabase.from('inicio_config').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data || { id: 1 };
  },

  async saveInicioConfig(datos) {
    const { error } = await supabase.from('inicio_config')
      .upsert({ ...datos, id: 1, updated_at: new Date().toISOString() });
    if (error) throw error;
  },

  /**
   * Achica la foto en el navegador (lado mayor <= maxLado, WebP o JPEG) y la
   * sube al bucket público "inicio". Devuelve la URL pública.
   */
  async subirImagenInicio(file, carpeta, maxLado = 1600) {
    const blob = await _achicarImagen(file, maxLado);
    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const nombre = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2));
    const path = `${carpeta}/${nombre}.${ext}`;
    const { error } = await supabase.storage.from('inicio')
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    return supabase.storage.from('inicio').getPublicUrl(path).data.publicUrl;
  },

  /** Asientos de una planta CON datos de pasajero (vía RPC: join server-side). */
  async getAsientosByPlanta(plantaId) {
    const { data, error } = await supabase.rpc('get_asientos_con_pasajero', { p_planta_id: plantaId });
    if (error) throw error;
    return data || [];
  },

  async moverPasajero(plantaId, sourceCode, targetCode, targetPlantaId) {
    const { error } = await supabase.rpc('mover_pasajero', {
      p_planta_id: plantaId, p_source_code: sourceCode, p_target_code: targetCode,
      p_target_planta_id: targetPlantaId || null
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

  async eliminarFila(plantaId, fila, forzar) {
    const { error } = await supabase.rpc('eliminar_fila', { p_planta_id: plantaId, p_fila: fila, p_forzar: !!forzar });
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

async function _achicarImagen(file, maxLado) {
  if (!file || !/^image\//.test(file.type)) throw new Error('El archivo no es una imagen');
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    el.src = url;
  });
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * escala);
  canvas.height = Math.round(img.naturalHeight * escala);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const toBlob = (tipo) => new Promise(res => canvas.toBlob(res, tipo, 0.82));
  let blob = await toBlob('image/webp');
  // Safari viejo no genera WebP: devuelve PNG. En ese caso, JPEG.
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}

window.ApiAdmin = ApiAdmin;
