// ============================================================
// api.js - Capa de acceso a datos (Supabase)
// ============================================================
// Reemplaza los endpoints AppScript (apiGetTrips, apiGetSeats,
// apiReserve, etc.) del prototipo original.

const Api = {

  /** Lista de viajes activos, con sus plantas. */
  async getViajes() {
    const { data, error } = await supabase
      .from('viajes')
      .select('id, nombre, tipo, start_at, plantas(id, etiqueta, orden), destino:inicio_destinos(imagen_url)')
      .eq('activo', true)
      .neq('tipo', 'evento') // eventos/fiestas sin bus: no tienen asientos
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

  /**
   * Viajes publicados en el inicio ("Próximos viajes"), con o sin la
   * selección de asientos habilitada. "activo" = selección habilitada.
   * Se omiten los que ya salieron hace más de un día.
   */
  /** Solo el WhatsApp de reservas (para el "Escribinos" de la lista de viajes). */
  async getWhatsappReservas() {
    const { data, error } = await supabase.from('inicio_config').select('whatsapp').eq('id', 1).maybeSingle();
    if (error) throw error;
    return (data && data.whatsapp) || '';
  },

  async getViajesInicio() {
    const desde = new Date(Date.now() - 86400000).toISOString();
    const { data, error } = await supabase
      .from('viajes')
      .select('id, nombre, tipo, start_at, activo, plantas(id, etiqueta, orden), destino:inicio_destinos(nombre, imagen_url)')
      .eq('publicado_inicio', true)
      .or(`start_at.is.null,start_at.gte.${desde}`)
      .order('start_at', { ascending: true, nullsFirst: false });

    if (error) throw error;
    (data || []).forEach(v => {
      if (Array.isArray(v.plantas)) {
        v.plantas.sort((a, b) => (a.orden || 0) - (b.orden || 0));
      }
    });
    return data || [];
  },

  /**
   * Contenido editable del inicio (Panel › Inicio). La RLS ya filtra lo
   * inactivo y los avisos fuera de su vigencia para el público.
   */
  async getInicioContenido() {
    const orden = (q) => q.order('orden', { ascending: true }).order('created_at', { ascending: true });
    const [config, bloques, equipo, destinos] = await Promise.all([
      supabase.from('inicio_config').select('*').eq('id', 1).maybeSingle(),
      orden(supabase.from('inicio_bloques').select('*').eq('activo', true)),
      orden(supabase.from('inicio_equipo').select('*').eq('activo', true)),
      orden(supabase.from('inicio_destinos').select('*').eq('activo', true))
    ]);
    [config, bloques, equipo, destinos].forEach(r => { if (r.error) throw r.error; });
    const ahora = Date.now();
    const vigente = b => (!b.visible_desde || new Date(b.visible_desde).getTime() <= ahora)
                      && (!b.visible_hasta || new Date(b.visible_hasta).getTime() > ahora);
    const bl = (bloques.data || []).filter(vigente);
    return {
      config: config.data || {},
      avisos: bl.filter(b => b.tipo === 'aviso'),
      faq: bl.filter(b => b.tipo === 'faq'),
      equipo: equipo.data || [],
      destinos: destinos.data || []
    };
  },

  /** Todos los asientos de una planta (sin datos de pasajero: ya no viven aca). */
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
   * Reserva uno o varios asientos de forma atomica.
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
  /**
   * Canal en vivo de una planta:
   *  - postgres_changes: reservas confirmadas (cambios en reservas.asientos).
   *  - presence: asientos que cada visitante tiene marcados y todavía no
   *    reservó. No se guarda nada en la base; si la persona cierra la
   *    página o pierde conexión, su presencia desaparece sola.
   * presence = { key, onSync(estado), onReady() }
   */
  subscribeToPlanta(plantaId, onChange, presence) {
    const opts = presence && presence.key ? { config: { presence: { key: presence.key } } } : undefined;
    let channel = supabase.channel('asientos-planta-' + plantaId, opts)
      .on(
        'postgres_changes',
        { event: '*', schema: 'reservas', table: 'asientos', filter: 'planta_id=eq.' + plantaId },
        onChange
      );
    if (presence && presence.onSync) {
      channel = channel.on('presence', { event: 'sync' }, () => presence.onSync(channel.presenceState()));
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' && presence && presence.onReady) presence.onReady();
    });
    return channel;
  },

  /**
   * Busca pasajeros ya cargados en la base de clientes (public.pasajeros)
   * para autocompletar el formulario de reserva cuando el staff está
   * logueado. Depende 100% de RLS: la tabla solo es visible para
   * auth.email() presente en staff con status 'enabled' — no filtramos
   * nada acá, Postgres ya lo hace. Si quien llama no es staff válido,
   * simplemente vuelve una lista vacía (o error de permiso), nunca datos.
   *
   * No se llama nunca si Auth.isAuthorized() es false: el input de
   * autocomplete ni siquiera se muestra a un visitante anónimo.
   */
  async buscarPasajeros(query) {
    const q = (query || '').trim();
    if (q.length < 3) return []; // evita ida y vuelta por cada tecla + scrape letra a letra

    const { data, error } = await supabase
      .schema('public')
      .from('pasajeros')
      .select('"Pasajero", "Documento de Identidad"') // comillas dobles obligatorias: PostgREST
                                                        // recorta espacios de nombres de columna
                                                        // si no van entre comillas dentro del string
      .ilike('Pasajero', `%${q}%`)
      .limit(8);

    if (error) {
      console.error('[buscarPasajeros]', error);
      return []; // fallo silencioso: el autocomplete es una ayuda, no algo crítico
    }
    return data || [];
  },

  /**
   * Inserta una aceptación de Bases y Condiciones (tabla pública
   * "basesycondiciones", la misma que usa el Apps Script del Sheet).
   * "estado" se marca "aceptado" directo al insertar: antes lo completaba
   * Apps Script junto con el resto de la fila, pero ahora esa columna
   * depende de la web en el momento de la aceptación. "estado_envio"
   * queda en null porque el PDF/email lo sigue completando un proceso
   * aparte más adelante.
   */
  async aceptarBasesYCondiciones({ nombre, ci, email_disponible, email }) {
    const { error } = await supabase
      .schema('public')
      .from('basesycondiciones')
      .insert({
        nombre,
        ci,
        email_disponible,
        email: email || null,
        estado: 'aceptado',
        estado_envio: null,
        correo_duplicado: false,
        link: null
      });

    if (error) throw error;
  },

  /**
   * Inserta la información adicional del Paso 2 del wizard de Bases y
   * Condiciones (tabla "reservas.bases_info_adicional"): cumpleaños
   * (opcional), contacto de emergencia y observaciones de salud
   * (opcional). Vinculada a basesycondiciones por CI, no por id — mismo
   * criterio que se usó para esa tabla. La columna "observaciones" es la
   * misma que usa contacto-emergencia.js vía el RPC
   * guardar_contacto_emergencia_por_token, así ambos flujos escriben al
   * mismo lugar.
   */
  async guardarInfoAdicional({ ci, cumpleanos, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco, observaciones }) {
    const { error } = await supabase
      .schema('reservas')
      .from('bases_info_adicional')
      .insert({
        ci,
        cumpleanos: cumpleanos || null, // 'YYYY-MM-DD' con año fijo 2000, o null si no la cargó
        contacto_emergencia_nombre,
        contacto_emergencia_telefono,
        contacto_emergencia_parentesco,
        observaciones: observaciones || null
      });

    if (error) throw error;
  }
};

window.Api = Api;
