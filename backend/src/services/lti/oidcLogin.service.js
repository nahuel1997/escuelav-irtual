// Paso 1 de un launch de LTI 1.3: "OIDC Third-Party Initiated Login".
// El LMS manda al navegador del usuario a nuestro /api/lti/login con
// algunos parámetros (iss, login_hint, target_link_uri, ...) — NO nos
// manda todavía ninguna identidad verificable, es solo el pedido de
// arrancar el ida y vuelta. Nosotros generamos state+nonce, los guardamos,
// y redirigimos al navegador al auth_login_url DE LA PLATAFORMA para que
// sea ELLA la que responda con el id_token firmado (eso es lo que hace
// que este primer paso no se pueda falsificar: el id_token lo firma la
// plataforma, no nosotros).
const crypto = require('crypto');
const db = require('../../config/db');
const env = require('../../config/env');
const ltiPlatformModel = require('../../models/ltiPlatform.model');
const { AppError } = require('../../middlewares/error.middleware');

function nuestraUrlLaunch() {
  return `${env.BACKEND_URL || 'http://localhost:3000'}/api/lti/launch`;
}

async function iniciarLogin({ iss, login_hint: loginHint, client_id: clientId, lti_deployment_id: deploymentId, target_link_uri: targetLinkUri }) {
  if (!iss || !loginHint) throw new AppError('Falta iss o login_hint en el pedido de login de LTI', 400);

  // El client_id puede no venir en este primer pedido (algunas
  // plataformas lo omiten cuando el issuer solo tiene una integración
  // nuestra registrada) — si no vino, buscamos por issuer solo y exigimos
  // que haya una única coincidencia activa, para no adivinar cuál.
  let plataforma;
  if (clientId) {
    plataforma = await ltiPlatformModel.findByIssuerAndClient(iss, clientId);
  } else {
    const candidatas = await db('lti_platforms').where({ issuer: iss, activo: true });
    if (candidatas.length === 1) plataforma = candidatas[0];
  }

  if (!plataforma) throw new AppError('Esta plataforma no está registrada (o el client_id no coincide) — pedile al admin que la dé de alta en /admin-panel/lti', 400);

  const state = crypto.randomBytes(24).toString('hex');
  const nonce = crypto.randomBytes(24).toString('hex');
  await db('lti_launch_states').insert({ state, nonce, platform_id: plataforma.id });

  const params = new URLSearchParams({
    scope: 'openid',
    response_type: 'id_token',
    response_mode: 'form_post',
    prompt: 'none',
    client_id: plataforma.client_id,
    redirect_uri: nuestraUrlLaunch(),
    login_hint: loginHint,
    state,
    nonce,
  });
  if (deploymentId) params.set('lti_deployment_id', deploymentId);
  if (targetLinkUri) params.set('lti_message_hint', targetLinkUri);

  return `${plataforma.auth_login_url}?${params.toString()}`;
}

module.exports = { iniciarLogin };
