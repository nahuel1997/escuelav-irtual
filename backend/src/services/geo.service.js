// Resuelve país/provincia a partir de una IP para el historial de sesiones
// del admin (ver login_logs.pais/provincia). Mejor esfuerzo, igual que
// mail.service.js o loginLogModel.create: si falla o tarda, la sesión se
// crea igual, sin país/provincia — nunca puede romper un login.
//
// Trade-off explícito: usamos ip-api.com (gratis, sin API key) en vez de
// una base GeoIP local (tipo MaxMind GeoLite2) para no tener que
// descargar/actualizar un archivo de datos a mano. A cambio: depende de
// que ip-api.com esté arriba, tiene un límite de 45 consultas/minuto por
// IP de origen (de sobra para este volumen), y su plan gratuito es HTTP
// (no HTTPS) — no es un problema acá porque la llamada la hace el server,
// nunca el navegador del usuario.
const env = require('../config/env');

// Cache en memoria (se pierde al reiniciar el server, no hace falta que
// sobreviva): evita pedirle a la API la misma IP en cada login de la
// misma oficina/hogar. TTL de 6 horas, más que suficiente para no gastar
// el límite de consultas y lo bastante corto para no mostrar datos viejos
// si alguien cambia de red.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map(); // ip -> { valor: {pais, provincia}, expiraEn }

const RANGOS_PRIVADOS = [
  /^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/, /^::ffff:127\./, /^fc/i, /^fd/i, /^fe80:/i,
];

function esIpPrivada(ip) {
  if (!ip) return true;
  const limpia = ip.replace(/^::ffff:/, '');
  return RANGOS_PRIVADOS.some((r) => r.test(ip) || r.test(limpia));
}

// Devuelve { pais, provincia } (ambos pueden ser null). Nunca tira: toda
// la función está pensada para no interrumpir el flujo de login.
async function resolverUbicacion(ip) {
  // Nunca pega a la red real en tests (ver mismo criterio en
  // mail.service.js con NODE_ENV==='test') — además, en desarrollo/test
  // casi siempre la IP es local de todos modos.
  if (env.NODE_ENV === 'test') return { pais: null, provincia: null };
  if (esIpPrivada(ip)) return { pais: 'Red local', provincia: null };

  const cacheada = cache.get(ip);
  if (cacheada && cacheada.expiraEn > Date.now()) return cacheada.valor;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await resp.json();
    const valor = data.status === 'success'
      ? { pais: data.country || null, provincia: data.regionName || null }
      : { pais: null, provincia: null };
    cache.set(ip, { valor, expiraEn: Date.now() + CACHE_TTL_MS });
    return valor;
  } catch (_e) {
    // Timeout, sin red, API caída, etc. — la sesión se crea sin ubicación.
    return { pais: null, provincia: null };
  }
}

module.exports = { resolverUbicacion, esIpPrivada };
