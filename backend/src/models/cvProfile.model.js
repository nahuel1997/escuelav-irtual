const db = require('../config/db');

const CAMPOS_JSON = ['experiencia', 'educacion', 'habilidades', 'idiomas'];

function parsear(row) {
  if (!row) return null;
  const parsed = { ...row };
  CAMPOS_JSON.forEach((campo) => {
    try {
      parsed[campo] = JSON.parse(row[campo] || '[]');
    } catch {
      parsed[campo] = [];
    }
  });
  parsed.incluirCursosPlataforma = !!row.incluir_cursos_plataforma;
  return parsed;
}

function getByUserId(userId) {
  return db('cv_profiles').where({ user_id: userId }).first().then(parsear);
}

// Guarda el perfil completo del usuario: si ya tenía uno lo pisa entero
// (no hace merge campo a campo — el formulario del frontend siempre manda
// el estado completo), si no existía lo crea. Devuelve el registro ya
// guardado y parseado, listo para precargar el formulario.
async function upsert(userId, datos) {
  const fila = {
    user_id: userId,
    nombre_completo: datos.datosPersonales?.nombreCompleto || '',
    email: datos.datosPersonales?.email || '',
    telefono: datos.datosPersonales?.telefono || '',
    ubicacion: datos.datosPersonales?.ubicacion || '',
    linkedin: datos.datosPersonales?.linkedin || '',
    resumen_profesional: datos.datosPersonales?.resumenProfesional || '',
    experiencia: JSON.stringify(datos.experiencia || []),
    educacion: JSON.stringify(datos.educacion || []),
    habilidades: JSON.stringify(datos.habilidades || []),
    idiomas: JSON.stringify(datos.idiomas || []),
    incluir_cursos_plataforma: datos.incluirCursosPlataforma !== false,
    updated_at: db.fn.now(),
  };

  const existente = await db('cv_profiles').where({ user_id: userId }).first();
  if (existente) {
    await db('cv_profiles').where({ user_id: userId }).update(fila);
  } else {
    await db('cv_profiles').insert(fila);
  }
  return getByUserId(userId);
}

module.exports = { getByUserId, upsert };
