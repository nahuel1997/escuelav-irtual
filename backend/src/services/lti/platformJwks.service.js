// Trae y cachea (10 minutos) el JWKS público de una plataforma externa,
// para verificar la firma de los id_token que nos manda. Usamos el
// `fetch` global de Node (disponible desde Node 18+, este proyecto corre
// en Node 22 LTS) — no hace falta agregar axios/node-fetch para esto.
const { jwkToPublicKeyObject } = require('./jwk.util');
const { AppError } = require('../../middlewares/error.middleware');

const TTL_MS = 10 * 60 * 1000;
const cache = new Map(); // jwks_url -> { jwks, expiraEn }

async function fetchJwks(jwksUrl) {
  const cacheado = cache.get(jwksUrl);
  if (cacheado && cacheado.expiraEn > Date.now()) return cacheado.jwks;

  let respuesta;
  try {
    respuesta = await fetch(jwksUrl, { headers: { Accept: 'application/json' } });
  } catch (err) {
    throw new AppError(`No se pudo contactar el JWKS de la plataforma (${jwksUrl}): ${err.message}`, 502);
  }
  if (!respuesta.ok) {
    throw new AppError(`La plataforma respondió ${respuesta.status} al pedir su JWKS`, 502);
  }
  const jwks = await respuesta.json();
  cache.set(jwksUrl, { jwks, expiraEn: Date.now() + TTL_MS });
  return jwks;
}

// Devuelve el KeyObject público correspondiente al `kid` del header del
// id_token. Si no está en la copia cacheada, la refresca una vez (la
// plataforma puede haber rotado claves) antes de darse por vencido.
async function getPlatformPublicKey(jwksUrl, kid) {
  let jwks = await fetchJwks(jwksUrl);
  let jwk = jwks.keys.find((k) => k.kid === kid);

  if (!jwk) {
    cache.delete(jwksUrl);
    jwks = await fetchJwks(jwksUrl);
    jwk = jwks.keys.find((k) => k.kid === kid);
  }

  if (!jwk) throw new AppError('La plataforma no tiene ninguna clave publicada con el "kid" del id_token', 401);
  return jwkToPublicKeyObject(jwk);
}

module.exports = { getPlatformPublicKey };
