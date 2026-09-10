const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');
const { iniciarLogin } = require('../services/lti/oidcLogin.service');
const { validarLaunch } = require('../services/lti/launchValidator.service');
const { resolverUsuario, asegurarInscripcion } = require('../services/lti/userProvisioning.service');
const { getJwks } = require('../services/lti/keys.service');

// GET o POST /api/lti/login — paso 1 (OIDC third-party initiated login).
// La plataforma puede mandarlo por cualquiera de los dos métodos según el
// estándar, por eso este handler lee de query O de body indistintamente.
const login = asyncHandler(async (req, res) => {
  const params = { ...req.query, ...req.body };
  const redirectUrl = await iniciarLogin(params);
  res.redirect(redirectUrl);
});

// POST /api/lti/launch — paso 2. La plataforma llega acá con un submit de
// formulario (no es el usuario navegando a mano). Si todo valida, no
// mandamos al navegador directo al frontend con el token (quedaría en el
// historial) — generamos un código de un solo uso y lo redirigimos a una
// página del frontend que lo cambia por la sesión real.
const launch = asyncHandler(async (req, res) => {
  const { plataforma, claims } = await validarLaunch(req.body);
  const usuario = await resolverUsuario(plataforma, claims);
  await asegurarInscripcion(plataforma, usuario, claims);

  const token = jwt.sign({ id: usuario.id, rol: usuario.rol, jti: crypto.randomBytes(16).toString('hex') }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const code = crypto.randomBytes(24).toString('hex');
  await db('lti_launch_codes').insert({
    code,
    user_id: usuario.id,
    redirect_to: `/classroom/${plataforma.curso_id}`,
  });

  // Le mandamos el JWT ya armado al frontend junto con el código de
  // exchange — el frontend igual tiene que ir a buscarlo con el código
  // (ver exchange más abajo) porque el que llega acá es el navegador dela
  // plataforma en un POST, no una sesión que el frontend pueda leer.
  res.redirect(`${env.FRONTEND_URL}/lti/entrando?code=${code}`);
});

// POST /api/lti/exchange — el frontend cambia el código de un solo uso
// por el token de sesión real + a dónde entrar.
const exchange = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) throw new AppError('Falta el código de LTI', 400);

  const fila = await db('lti_launch_codes').where({ code }).first();
  if (!fila || fila.usado) throw new AppError('Este link de acceso ya se usó o no es válido — volvé a entrar desde el LMS', 400);

  const vencido = Date.now() - new Date(fila.created_at).getTime() > 2 * 60 * 1000;
  await db('lti_launch_codes').where({ id: fila.id }).update({ usado: true });
  if (vencido) throw new AppError('Este link de acceso expiró — volvé a entrar desde el LMS', 400);

  const usuario = await db('users').where({ id: fila.user_id }).first();
  const token = jwt.sign({ id: usuario.id, rol: usuario.rol, jti: crypto.randomBytes(16).toString('hex') }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  res.json({
    token,
    redirectTo: fila.redirect_to,
    user: { id: usuario.id, nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, rol: usuario.rol },
  });
});

// GET /api/lti/jwks — nuestras claves públicas (formato JWK Set estándar),
// para que cualquier plataforma que nos registre pueda verificar lo que
// firmamos (hoy: los pedidos de access token de AGS).
const jwks = asyncHandler(async (req, res) => {
  res.json(await getJwks());
});

module.exports = { login, launch, exchange, jwks };
