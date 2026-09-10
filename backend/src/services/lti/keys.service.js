// Par de claves RSA propio de esta app como "Tool" LTI. Se genera solo,
// una única vez (la primera vez que hace falta: al pedir nuestro JWKS o
// al armar un client_assertion para AGS) y se guarda en la base — así el
// admin no tiene que generar ni pegar ningún secreto a mano.
const crypto = require('crypto');
const db = require('../../config/db');
const { publicPemToJwk } = require('./jwk.util');

let cacheEnMemoria = null;

async function getOrCreateActiveKey() {
  if (cacheEnMemoria) return cacheEnMemoria;

  const existente = await db('lti_tool_keys').where({ activo: true }).orderBy('created_at', 'desc').first();
  if (existente) {
    cacheEnMemoria = existente;
    return existente;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const kid = crypto.randomBytes(8).toString('hex');

  await db('lti_tool_keys').insert({ kid, private_key_pem: privateKey, public_key_pem: publicKey });
  const fila = await db('lti_tool_keys').where({ kid }).first();
  cacheEnMemoria = fila;
  return fila;
}

async function getJwks() {
  const clave = await getOrCreateActiveKey();
  return { keys: [publicPemToJwk(clave.public_key_pem, clave.kid)] };
}

module.exports = { getOrCreateActiveKey, getJwks };
