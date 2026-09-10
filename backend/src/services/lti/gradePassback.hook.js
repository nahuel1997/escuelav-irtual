// Punto de enganche entre "un alumno completó un curso" (evento que ya
// existía, ver classroom.controller.js::markCompleted) y el passback de
// notas de AGS: si esa inscripción vino de un launch de LTI y la
// plataforma habilitó AGS para ese link (nos pasó un lineitem_url), le
// mandamos la nota de vuelta. Si no vino de LTI, o AGS no estaba
// habilitado, no hace nada — el resto de la app sigue exactamente igual
// que antes de esta integración.
const db = require('../../config/db');
const ltiPlatformModel = require('../../models/ltiPlatform.model');
const enrollmentModel = require('../../models/enrollment.model');
const { enviarNota } = require('./ags.service');

async function notificarCursoCompletado(userId, courseId) {
  try {
    const enrollment = await enrollmentModel.findByUserAndCourse(userId, courseId);
    if (!enrollment) return;

    const link = await db('lti_enrollment_links').where({ enrollment_id: enrollment.id }).first();
    if (!link || !link.lineitem_url) return;

    const plataforma = await ltiPlatformModel.getById(link.platform_id);
    if (!plataforma || !plataforma.activo) return;

    await enviarNota({
      plataforma,
      lineitemUrl: link.lineitem_url,
      ltiSub: link.lti_sub,
      scoreGiven: 1,
      scoreMaximum: 1,
      actividadTerminada: true,
    });
  } catch (err) {
    // Best-effort a propósito: que la plataforma externa esté caída, o
    // haya rotado credenciales, no puede impedir que acá adentro se
    // marque el curso como completado — el profesor ya vio la
    // confirmación en pantalla.
    console.error('[LTI] No se pudo mandar el passback de nota:', err.message);
  }
}

module.exports = { notificarCursoCompletado };
