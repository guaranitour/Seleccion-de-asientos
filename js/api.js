// ============================================================
// api.js — Capa de acceso a datos (Supabase)
// ============================================================
// Reemplaza los endpoints AppScript (apiGetTrips, apiGetSeats,
// apiReserve, etc.) del prototipo original.

const Api = {

  /** Lista de viajes activos, con sus plantas. */
  async getViajes() {
    const { data, error } = await supabase
      .from('viajes')
      .select('id, nombre, tipo, start_at, plantas(id, etiqueta, orden)')
      .eq('activo', true)
      .order('start_at', { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Ordenar plantas dentro de cada viaje
    (data || []).forEach(v => {
      if (Array.isArray(v.plantas)) {
        v.plantas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      }
    });
    return data || [];
  },

  /** Todos los asientos de una planta (sin datos de pasajero: ya no viven acá). */
  async getAsientosByPlanta(plantaId) {
    const { data, error } = await supabase
      .from('asientos')
      .select('id, code, fila, letra, estado')
      .eq('planta_id', plantaId)
      .order('fila', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  /**
   * Reserva uno o varios asientos de forma atómica.
   * pares: [{ code, pasajero, ci }, ...]
   */
  async reservarAsientos(plantaId, pares) {
    const { error } = await supabase.rpc('reservar_asientos', {
      p_planta_id: plantaId,
      p_pares: pares.map(p => ({ code: p.code, pasajero: p.pasajero, ci: p.ci }))
    });
    if (error) throw error;
  },

  /** Suscribe a cambios en tiempo real de los asientos de una planta. */
  subscribeToPlanta(plantaId, onChange) {
    const channel = supabase
      .channel('asientos-planta-' + plantaId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'reservas', table: 'asientos', filter: `planta_id=eq.${plantaId}` },
        (payload) => onChange(payload)
      )
      .subscribe();
    return channel;
  }
};

window.Api = Api;
