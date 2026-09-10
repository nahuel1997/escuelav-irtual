const env = require('../config/env');
const ltiPlatformModel = require('../models/ltiPlatform.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Datos que el admin necesita para dar de alta esta app del lado del LMS
// (Moodle/Canvas/etc. piden exactamente estas 3 URLs al registrar una
// herramienta LTI 1.3 externa).
const infoTool = asyncHandler(async (req, res) => {
  res.json({
    openidLoginUrl: `${env.BACKEND_URL}/api/lti/login`,
    launchUrl: `${env.BACKEND_URL}/api/lti/launch`,
    jwksUrl: `${env.BACKEND_URL}/api/lti/jwks`,
  });
});

const listar = asyncHandler(async (req, res) => {
  res.json({ plataformas: await ltiPlatformModel.listAll() });
});

const campos = ['nombre', 'issuer', 'client_id', 'deployment_id', 'auth_login_url', 'auth_token_url', 'jwks_url', 'curso_id'];

function tomarCampos(body) {
  const faltante = campos.find((c) => !body[c]);
  if (faltante) throw new AppError(`Falta el campo "${faltante}"`, 400);
  return campos.reduce((acc, c) => ({ ...acc, [c]: body[c] }), {});
}

const crear = asyncHandler(async (req, res) => {
  const plataforma = await ltiPlatformModel.create(tomarCampos(req.body));
  res.status(201).json({ plataforma });
});

const actualizar = asyncHandler(async (req, res) => {
  const existente = await ltiPlatformModel.getById(req.params.id);
  if (!existente) throw new AppError('Plataforma no encontrada', 404);
  const plataforma = await ltiPlatformModel.update(req.params.id, tomarCampos(req.body));
  res.json({ plataforma });
});

const toggleActivo = asyncHandler(async (req, res) => {
  const existente = await ltiPlatformModel.getById(req.params.id);
  if (!existente) throw new AppError('Plataforma no encontrada', 404);
  const plataforma = await ltiPlatformModel.update(req.params.id, { activo: !existente.activo });
  res.json({ plataforma });
});

const borrar = asyncHandler(async (req, res) => {
  const existente = await ltiPlatformModel.getById(req.params.id);
  if (!existente) throw new AppError('Plataforma no encontrada', 404);
  await ltiPlatformModel.remove(req.params.id);
  res.json({ ok: true });
});

module.exports = { infoTool, listar, crear, actualizar, toggleActivo, borrar };
