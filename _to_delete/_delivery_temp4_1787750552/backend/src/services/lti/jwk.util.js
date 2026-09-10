// Conversión entre PEM (lo que usa jsonwebtoken para firmar/verificar) y
// JWK (el formato en el que se publican/consumen claves públicas en LTI:
// tanto NUESTRO /api/lti/jwks como el jwks_url de cada plataforma están
// en este formato). Usamos únicamente node:crypto — sin agregar
// dependencias nuevas al proyecto (Node 22 exporta/importa JWK de forma
// nativa desde hace varias versiones).
const crypto = require('crypto');

function publicPemToJwk(publicKeyPem, kid) {
  const keyObject = crypto.createPublicKey(publicKeyPem);
  const jwk = keyObject.export({ format: 'jwk' });
  return { ...jwk, kid, use: 'sig', alg: 'RS256' };
}

function jwkToPublicKeyObject(jwk) {
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

module.exports = { publicPemToJwk, jwkToPublicKeyObject };
