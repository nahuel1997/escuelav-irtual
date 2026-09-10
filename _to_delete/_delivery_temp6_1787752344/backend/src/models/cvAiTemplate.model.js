// Capa de acceso a "cv_ai_templates" — las 3 plantillas HTML de "CV para
// IA" (ChatGPT/Claude/Gemini), editables desde /admin-panel/cv-ia. Mismo
// criterio que emailTemplate.model.js: el set de claves nace fijo (ver
// db/seeds/003_cv_ai_templates.js) y el editor solo permite EDITAR
// nombre/html/activo de una plantilla existente, nunca crear una clave
// nueva a mano — evita una plantilla "huérfana" que ningún destino de
// generación usa.
const db = require('../config/db');

// better-sqlite3 devuelve "activo" como 0/1 crudo — lo normalizamos acá
// (mismo fix que emailTemplate.model.js/ltiPlatform.model.js) para que el
// checkbox del admin y el "if (!plantilla.activo)" del motor de
// generación reciban siempre un boolean de verdad.
function normalizar(row) {
  if (!row) return row;
  row.activo = Boolean(row.activo);
  return row;
}

async function listAll() {
  const rows = await db('cv_ai_templates').select('*').orderBy('nombre');
  return rows.map(normalizar);
}

async function findByClave(clave) {
  const row = await db('cv_ai_templates').where({ clave }).first();
  return normalizar(row);
}

async function updateByClave(clave, { nombre, html, activo }) {
  const patch = {};
  if (nombre !== undefined) patch.nombre = nombre;
  if (html !== undefined) patch.html = html;
  if (activo !== undefined) patch.activo = activo;
  patch.updated_at = db.fn.now();
  await db('cv_ai_templates').where({ clave }).update(patch);
  return findByClave(clave);
}

module.exports = { listAll, findByClave, updateByClave };
