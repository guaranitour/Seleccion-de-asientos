/**
 * Cloudflare Pages Function — corre en el edge antes de servir cualquier
 * asset estático o pasar a la SPA.
 *
 * Problema que resuelve:
 *   Los crawlers de previews (WhatsApp, Facebook, Telegram, X, LinkedIn,
 *   Discord, Slack) NO ejecutan JavaScript. Nuestra SPA resuelve todo el
 *   contenido client-side, así que si un crawler pide "/reservas" o
 *   "/bases-y-condiciones" y le servimos el index.html genérico, ve
 *   siempre el mismo preview sin importar la ruta.
 *
 * Solución:
 *   Para las rutas que necesitan preview propio, si quien pide la página
 *   es un crawler conocido, respondemos con un HTML mínimo que contiene
 *   solo los meta tags og:*/twitter:* correctos. Si es un humano (o un
 *   bot no reconocido), dejamos pasar la request sin tocarla — Cloudflare
 *   sirve la SPA normalmente vía _redirects.
 *
 * Ventaja sobre archivos físicos por ruta (el approach anterior en
 * GitHub Pages): agregar una ruta nueva es una entrada en ROUTES_META,
 * no un archivo HTML con su propio script de redirect.
 */

// Metadata de preview por ruta. Agregar acá cualquier ruta nueva que
// necesite su propio og:title / og:description / og:image.
const ROUTES_META = {
  '/reservas': {
    title: 'Reservá tu asiento — Destino Guaraní',
    description: 'Elegí tu asiento para el viaje en menos de 2 minutos.',
    image: 'https://www.guaranitour.com/RESERVAS_IMAGEN.png',
  },
  '/bases-y-condiciones': {
    title: 'Bases y Condiciones — Destino Guaraní',
    description: 'Confirmá tu aceptación de las Bases y Condiciones del viaje en menos de 2 minutos.',
    image: 'https://www.guaranitour.com/BYC_IMAGEN.png',
  },
};

// User-Agents de crawlers de preview conocidos. No es necesario cubrir
// "todos los bots" — solo los que generan previews de link, que es el
// único caso donde HTML sin JS importa.
const CRAWLER_UA_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|LinkedInBot|Slackbot|Discordbot|SkypeUriPreview|vkShare|Pinterest/i;

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPreviewHtml(url, meta) {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = escapeHtml(meta.image);
  const canonicalUrl = escapeHtml(url);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta property="og:type" content="website">
<meta property="og:url" content="${canonicalUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
</head>
<body></body>
</html>`;
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const meta = ROUTES_META[url.pathname];

  // Ruta sin preview propio configurado → tráfico normal, SPA de siempre.
  if (!meta) {
    return next();
  }

  const userAgent = request.headers.get('User-Agent') || '';
  const isCrawler = CRAWLER_UA_PATTERN.test(userAgent);

  // Humano (o bot no reconocido) pidiendo una ruta con preview propio
  // → dejamos pasar, la SPA rutea internamente como siempre.
  if (!isCrawler) {
    return next();
  }

  // Crawler pidiendo una ruta con preview propio → servimos el HTML
  // mínimo con los meta tags correctos, sin pasar por la SPA.
  return new Response(renderPreviewHtml(url.toString(), meta), {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Los crawlers cachean previews agresivamente igual, pero evitamos
      // que un CDN intermedio devuelva una respuesta vieja por mucho tiempo.
      'cache-control': 'public, max-age=300',
    },
  });
}
