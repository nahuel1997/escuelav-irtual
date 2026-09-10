// A partir de los claims YA VALIDADOS de un id_token de LTI, resuelve
// (o crea) la cuenta local correspondiente y la inscripción al curso
// mapeado para esa plataforma — así el resto de la app (classroom,
// progreso, etc.) funciona exactamente igual para alguien que entró por
// LTI que para alguien que se registró directo acá.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const enrollmentModel = require('../../models/enrollment.model');

const CLAIM_ROLES = 'https://purl.imsglobal.org/spec/lti/claim/roles';
const CLAIM_AGS_ENDPOINT = 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint';

const ROLES_INSTRUCTOR = [
  'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
  'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant',
];

function rolDesdeClaims(claims) {
  const roles = claims[CLAIM_ROLES] || [];
  const esInstructor = roles.some((r) => ROLES_INSTRUCTOR.includes(r));
  return esInstructor ? 'profesor' : 'alumno';
}

async function resolverUsuario(plataforma, claims) {
  const link = await db('lti_user_links').where({ platform_id: plataforma.id, lti_sub: claims.sub }).first();
  if (link) return db('users').where({ id: link.user_id }).first();

  const email = claims.email || `lti-${plataforma.id}-${claims.sub}@sin-email.lti`;
  let usuario = await db('users').where({ email }).first();

  if (!usuario) {
    // Password inutilizable a propósito: esta cuenta se pensó para
    // entrar por LTI, no por el login normal — igual necesita un hash
    // válido porque la columna es NOT NULL. Si el usuario alguna vez
    // quiere entrar también por login/contraseña, puede usar "olvidé mi
    // contraseña" para asignarse una real (mismo flujo que cualquiera).
    const passwordInutilizable = crypto.randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(passwordInutilizable, 10);

    const [row] = await db('users')
      .insert({
        nombre: claims.given_name || claims.name || 'Alumno',
        apellido: claims.family_name || 'LTI',
        email,
        password_hash: passwordHash,
        rol: rolDesdeClaims(claims),
        email_verificado: true, // Vino autenticado por la plataforma externa — no hace falta reverificar.
      })
      .returning('id');
    const userId = typeof row === 'object' ? row.id : row;
    usuario = await db('users').where({ id: userId }).first();
  }

  await db('lti_user_links').insert({ platform_id: plataforma.id, lti_sub: claims.sub, user_id: usuario.id });
  return usuario;
}

// Asegura la inscripción al curso mapeado para esta plataforma, y guarda
// el line item de AGS (si vino) para poder mandar notas más adelante.
async function asegurarInscripcion(plataforma, usuario, claims) {
  let enrollment = await enrollmentModel.findByUserAndCourse(usuario.id, plataforma.curso_id);
  if (!enrollment) {
    await enrollmentModel.create({
      user_id: usuario.id,
      course_id: plataforma.curso_id,
      payment_status: 'pagado',
      payment_method: 'lti',
      transaction_id: `LTI-${plataforma.id}-${claims.sub}`,
    });
    enrollment = await enrollmentModel.findByUserAndCourse(usuario.id, plataforma.curso_id);
  }

  const lineitemUrl = claims[CLAIM_AGS_ENDPOINT]?.lineitem || null;
  const existente = await db('lti_enrollment_links').where({ enrollment_id: enrollment.id }).first();
  if (existente) {
    await db('lti_enrollment_links').where({ id: existente.id }).update({ lineitem_url: lineitemUrl, lti_sub: claims.sub, updated_at: db.fn.now() });
  } else {
    await db('lti_enrollment_links').insert({ enrollment_id: enrollment.id, platform_id: plataforma.id, lti_sub: claims.sub, lineitem_url: lineitemUrl });
  }

  return enrollment;
}

module.exports = { resolverUsuario, asegurarInscripcion };
