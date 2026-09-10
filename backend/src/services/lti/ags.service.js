// Passback de notas: LTI Advantage Assignment and Grade Services (AGS).
// Le mandamos a la plataforma la nota/progreso de un alumno para el line
// item que ella misma nos indicó en el launch (ver
// userProvisioning.service.js). Dos pasos, como pide el estándar:
//   1) Conseguir un access token propio con client_credentials, firmando
//      nuestro pedido con LA CLAVE PRIVADA de esta app (no la de la
//      plataforma) — así la plataforma puede confirmar, contra nuestro
//      /api/lti/jwks, que el pedido es de verdad nuestro.
//   2) Postear la nota al endpoint de scores del line item con ese token.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getOrCreateActiveKey } = require('./keys.service');
const { AppError } = require('../../middlewares/error.middleware');

const SCOPE_SCORE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score';

async function obtenerAccessToken(plataforma) {
  const clave = await getOrCreateActiveKey();
  const ahora = Math.floor(Date.now() / 1000);

  const assertion = jwt.sign(
    {
      iss: plataforma.client_id,
      sub: plataforma.client_id,
      aud: plataforma.auth_token_url,
      iat: ahora,
      exp: ahora + 300,
      jti: crypto.randomBytes(16).toString('hex'),
    },
    clave.private_key_pem,
    { algorithm: 'RS256', keyid: clave.kid }
  );

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: assertion,
    scope: SCOPE_SCORE,
  });

  let respuesta;
  try {
    respuesta = await fetch(plataforma.auth_token_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch (err) {
    throw new AppError(`No se pudo pedir el access token de AGS a la plataforma: ${err.message}`, 502);
  }
  if (!respuesta.ok) {
    const texto = await respuesta.text().catch(() => '');
    throw new AppError(`La plataforma rechazó el pedido de access token de AGS (${respuesta.status}): ${texto}`, 502);
  }
  const data = await respuesta.json();
  return data.access_token;
}

// scoreGiven/scoreMaximum en la escala que use el line item (lo más común
// es 0..1 o 0..100 — quien llama a esta función decide la escala).
async function enviarNota({ plataforma, lineitemUrl, ltiSub, scoreGiven, scoreMaximum, actividadTerminada = true }) {
  if (!lineitemUrl) return { enviado: false, motivo: 'Este enrollment no tiene line item de AGS (la plataforma no lo habilitó en el launch)' };

  const accessToken = await obtenerAccessToken(plataforma);
  const payload = {
    userId: ltiSub,
    scoreGiven,
    scoreMaximum,
    activityProgress: actividadTerminada ? 'Completed' : 'InProgress',
    gradingProgress: actividadTerminada ? 'FullyGraded' : 'Pending',
    timestamp: new Date().toISOString(),
  };

  const url = lineitemUrl.endsWith('/scores') ? lineitemUrl : `${lineitemUrl}/scores`;
  let respuesta;
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.ims.lis.v1.score+json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new AppError(`No se pudo mandar la nota a la plataforma: ${err.message}`, 502);
  }
  if (!respuesta.ok) {
    const texto = await respuesta.text().catch(() => '');
    throw new AppError(`La plataforma rechazó la nota (${respuesta.status}): ${texto}`, 502);
  }

  return { enviado: true };
}

module.exports = { obtenerAccessToken, enviarNota };
