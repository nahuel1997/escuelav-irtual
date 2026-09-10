const jwt = require('jsonwebtoken');
const env = require('../config/env');
const enrollmentModel = require('../models/enrollment.model');
const achievementModel = require('../models/achievement.model');
const cvProfileModel = require('../models/cvProfile.model');
const cvAiTemplateModel = require('../models/cvAiTemplate.model');
const cvService = require('../services/cv.service');
const { getMotor } = require('../services/cvAi');
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

// PUT /cv/perfil — guarda los datos guardados del CV a mano, sin generar
// nada (ni PDF ni CV para IA). Antes de esto, la ÚNICA forma de persistir
// el perfil era descargar un CV — esto le da al alumno una pantalla
// aparte ("Mis datos de CV", /cv/datos) para editar y guardar sin
// necesidad de disparar una generación. Mismo upsert que usan /generate y
// /generar-ia, pero acá sí se espera el resultado (no es best-effort: es
// el propósito completo del endpoint) y se devuelve el perfil guardado.
const guardarPerfil = asyncHandler(async (req, res) => {
  const { datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma } = req.body;

  if (!datosPersonales || !datosPersonales.nombreCompleto) {
    throw new AppError('Faltan los datos personales (al menos nombre completo)', 400);
  }

  const perfil = await cvProfileModel.upsert(req.user.id, {
    datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma,
  });
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

// GET /cv/generadores-ia — catálogo de destinos disponibles (solo los
// activos, ver /admin-panel/cv-ia) para el desplegable del frontend.
// Público a propósito, mismo criterio que /generate: el creador de CV no
// exige cuenta.
const getGeneradoresIA = asyncHandler(async (req, res) => {
  const plantillas = await cvAiTemplateModel.listAll();
  res.json({
    generadores: plantillas.filter((p) => p.activo).map((p) => ({ clave: p.clave, nombre: p.nombre })),
  });
});

// POST /cv/generar-ia — arma el "CV para IA" (HTML completo) para el
// destino pedido, usando la plantilla que cargó el admin. No genera un
// PDF (a diferencia de /generate): el resultado es HTML pensado para
// leerse/pegarse en un chat de IA, no para imprimirse — igual se puede
// imprimir/guardar como PDF desde el propio navegador si hace falta.
//
// Nivel sugerido y recomendaciones de contenido salen de cv.service.js
// (reglas fijas según cursos de la categoría IA completados) — logueado
// o no, siempre se arma algo: sin sesión, nivel inicial y una
// recomendación genérica de arranque (ver cv.service.js::getRecomendaciones).
const generarIA = asyncHandler(async (req, res) => {
  const { destino, datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma } = req.body;

  if (!destino) throw new AppError('Falta indicar el destino (chatgpt, claude o gemini)', 400);
  if (!datosPersonales || !datosPersonales.nombreCompleto) {
    throw new AppError('Faltan los datos personales (al menos nombre completo)', 400);
  }

  const plantilla = await cvAiTemplateModel.findByClave(destino);
  if (!plantilla) throw new AppError('Destino desconocido', 404);
  if (!plantilla.activo) throw new AppError('Ese destino no está disponible por ahora', 409);

  const user = getUserIfLogged(req);

  let cursosPlataforma = [];
  if (incluirCursosPlataforma) {
    if (!user) throw new AppError('Para incluir tus cursos de la plataforma tenés que estar logueado', 401);
    cursosPlataforma = await enrollmentModel.listForUser(user.id);
  }

  const [nivel, recomendaciones] = await Promise.all([
    cvService.calcularNivelIA(user?.id),
    cvService.getRecomendaciones(user?.id),
  ]);

  if (user) {
    cvProfileModel.upsert(user.id, { datosPersonales, experiencia, educacion, habilidades, idiomas, incluirCursosPlataforma }).catch(() => {});
  }

  const motor = getMotor('plantilla');
  const { html } = motor.generar({
    plantilla,
    datosPersonales,
    experiencia: experiencia || [],
    educacion: educacion || [],
    habilidades: habilidades || [],
    idiomas: idiomas || [],
    cursosPlataforma,
    nivel,
    recomendaciones,
  });

  res.json({ html });
});

module.exports = { getPerfil, guardarPerfil, generate, getGeneradoresIA, generarIA };
