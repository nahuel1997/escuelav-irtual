// Paso 2 de un launch de LTI 1.3: la plataforma le hizo un POST
// (form_post) al navegador con destino a /api/lti/launch, con `id_token`
// (el JWT firmado por ELLA, no por nosotros) y el mismo `state` que le
// dimos en el paso 1. Acá lo validamos de punta a punta — esta es la
// parte que de verdad demuestra que el usuario es quien dice ser y que el
// pedido vino realmente de una plataforma registrada, no de cualquiera
// simulando el POST.
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const ltiPlatformModel = require('../../models/ltiPlatform.model');
const { getPlatformPublicKey } = require('./platformJwks.service');
const { AppError } = require('../../middlewares/error.middleware');

const VENCIMIENTO_STATE_MS = 10 * 60 * 1000;

async function consumirState(state) {
  const fila = await db('lti_launch_states').where({ state }).first();
  if (!fila) throw new AppError('El login de LTI no es válido o ya expiró — probá lanzar la herramienta de nuevo desde el LMS', 400);

  // Se borra apenas se lee, se haya podido usar o no: un `state` es de un
  // solo uso pase lo que pase (si algo más falla después, no queremos que
  // quede reutilizable).
  await db('lti_launch_states').where({ id: fila.id }).del();

  const vencido = Date.now() - new Date(fila.created_at).getTime() > VENCIMIENTO_STATE_MS;
  if (vencido) throw new AppError('El login de LTI tardó demasiado y expiró — probá lanzar la herramienta de nuevo desde el LMS', 400);

  return fila;
}

function decodificarHeaderSinVerificar(idToken) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) throw new AppError('El id_token de LTI no es un JWT válido', 400);
  return decoded.header;
}

async function validarLaunch({ id_token: idToken, state }) {
  if (!idToken || !state) throw new AppError('Falta id_token o state en el launch de LTI', 400);

  const estadoGuardado = await consumirState(state);
  const plataforma = await ltiPlatformModel.getById(estadoGuardado.platform_id);
  if (!plataforma || !plataforma.activo) throw new AppError('La plataforma de este launch ya no está activa', 400);

  const header = decodificarHeaderSinVerificar(idToken);
  if (header.alg !== 'RS256') throw new AppError(`Algoritmo de firma no soportado: ${header.alg}`, 400);

  const clavePublica = await getPlatformPublicKey(plataforma.jwks_url, header.kid);

  let claims;
  try {
    claims = jwt.verify(idToken, clavePublica, { algorithms: ['RS256'], issuer: plataforma.issuer, audience: plataforma.client_id });
  } catch (err) {
    throw new AppError(`El id_token de LTI no pasó la verificación: ${err.message}`, 401);
  }

  if (claims.nonce !== estadoGuardado.nonce) {
    throw new AppError('El id_token de LTI tiene un nonce que no coincide (posible reintento)', 401);
  }

  const CLAIM_VERSION = 'https://purl.imsglobal.org/spec/lti/claim/version';
  const CLAIM_MESSAGE_TYPE = 'https://purl.imsglobal.org/spec/lti/claim/message_type';
  const CLAIM_DEPLOYMENT_ID = 'https://purl.imsglobal.org/spec/lti/claim/deployment_id';

  if (claims[CLAIM_VERSION] !== '1.3.0') throw new AppError('El id_token no es de LTI 1.3.0', 400);
  if (claims[CLAIM_MESSAGE_TYPE] !== 'LtiResourceLinkRequest') {
    throw new AppError(`Tipo de mensaje LTI no soportado todavía: ${claims[CLAIM_MESSAGE_TYPE]}`, 400);
  }
  if (claims[CLAIM_DEPLOYMENT_ID] !== plataforma.deployment_id) {
    throw new AppError('El deployment_id del id_token no coincide con el registrado para esta plataforma', 401);
  }

  return { plataforma, claims };
}

module.exports = { validarLaunch };
