const jwt = require('jsonwebtoken');
const env = require('../config/env');
const enrollmentModel = require('../models/enrollment.model');
const achievementModel = require('../models/achievement.model');
const cvProfileModel = require('../models/cvProfile.model');
const cvService = require('../services/cv.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Si viene un token válido (opcional: el creador de CV también puede
// usarse sin estar logueado, cargando todo a mano), lo decodificamos para
// poder autocompletar cursos/logros de la plataforma y guardar el perfil.
function getUserIfLogged(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try {
    return jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
}

// GET /cv/perfil — precarga el formulario con lo último que el usuario
// guardó (requiere estar logueado: sin cuenta no hay dónde persistirlo).
const getPerfil = asyncHandler(async (req, res) => {
  const perfil = await cvProfileModel.getByUserId(req.user.id);
  res.json({ perfil });
});

const generate = asyncHandler(async (req, res) => {
  const { datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma } = req.body;

  if (!datosPersonales || !datosPersonales.nombreCompleto) {
    throw new AppError('Faltan los datos personales (al menos nombre completo)', 400);
  }

  let cursosPlataforma = [];
  let logrosPlataforma = [];

  const user = getUserIfLogged(req);

  if (incluirCursosPlataforma) {
    if (!user) throw new AppError('Para incluir tus cursos de la plataforma tenés que estar logueado', 401);
    cursosPlataforma = await enrollmentModel.listForUser(user.id);
    logrosPlataforma = await achievementModel.listForUser(user.id);
  }

  // Cada CV que se genera/descarga guarda automáticamente los datos
  // cargados como el perfil del usuario (si está logueado) — así la
  // próxima vez que entra al Creador de CV no arranca de cero. No
  // bloqueamos la descarga del PDF si el guardado falla por algún motivo:
  // es una comodidad, no el propósito principal del endpoint.
  if (user) {
    cvProfileModel.upsert(user.id, { datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma }).catch(() => {});
  }

  cvService.generateCvPdf(res, {
    datosPersonales,
    experiencia: experiencia || [],
    educacion: educacion || [],
    habilidades: habilidades || [],
    idiomas: idiomas || [],
    cursosPlataforma,
    logrosPlataforma,
  });
});

module.exports = { getPerfil, generate };
