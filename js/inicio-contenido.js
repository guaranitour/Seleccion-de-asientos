// ============================================================
// inicio-contenido.js — Textos del inicio (transitorio)
// ============================================================
// Hasta que exista la sección "Panel › Inicio", el contenido fijo del
// inicio vive acá. Cualquier bloque vacío ('' o []) NO se muestra, así
// nunca aparece información inventada en la web.
//
// Lo que sí se maneja desde el panel desde ya: "Próximos viajes" sale de
// la tabla reservas.viajes (interruptor "Publicado en el inicio").
// ============================================================

const INICIO_CONTENIDO = {
  portada: {
    titulo: 'Viajá tranquilo, nosotros nos encargamos del resto',
    texto: 'Conocé nuestras salidas confirmadas y reservá tu lugar por WhatsApp.'
  },

  // Número en formato internacional, solo dígitos. Ej.: '595981123456'.
  // Si queda vacío se ocultan el botón flotante y "Reservar por WhatsApp".
  whatsapp: '',

  contacto: {
    instagram: '',   // usuario sin @, ej.: 'destinoguarani'
    facebook: '',    // URL completa de la página
    email: '',
    direccion: '',
    mapsUrl: '',     // link de Google Maps para "Cómo llegar"
    horarios: []     // [{ dia: 'Lunes a viernes', hora: '08:00 – 18:00' }]
  },

  // Párrafo de "Quiénes somos". Vacío = no se muestra el texto.
  nosotros: '',

  // [{ nombre, cargo, descripcion, foto (URL, opcional), whatsapp (opcional) }]
  equipo: [],

  // [{ nombre, pais, descripcion, imagen (URL, opcional), etiquetas: [] }]
  destinos: [],

  faq: [
    {
      pregunta: '¿Cómo reservo mi lugar?',
      respuesta: 'Escribinos por WhatsApp y te acompañamos a asegurar tu lugar con el pago de la seña.'
    },
    {
      pregunta: '¿Cuándo elijo mi asiento?',
      respuesta: 'Una vez abonada la seña y aceptadas las Bases y Condiciones. Cuando habilitemos la selección te avisaremos para que elijas el lugar que prefieras.'
    },
    {
      pregunta: '¿Dónde acepto las Bases y Condiciones?',
      respuesta: 'Desde el menú, en "Bases y condiciones". Ahí también cargás tu contacto de emergencia.'
    }
  ]
};

window.INICIO_CONTENIDO = INICIO_CONTENIDO;
