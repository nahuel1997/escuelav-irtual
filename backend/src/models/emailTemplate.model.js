// Capa de acceso a "email_templates" — las plantillas de los mails que
// manda la plataforma, editables desde /admin-panel/mails (pestaña
// Plantillas). El set de claves válidas nace fijo (ver
// db/seeds/002_email_templates.js): el editor solo permite EDITAR asunto/
// cuerpo/activo de una plantilla existente, nunca crear una clave nueva a
// mano — eso evita que el admin genere una plantilla "huérfana" que
// ningún mail dispara.
const db = require('../config/db');

// better-sqlite3 devuelve "activo" (boolean) como 0/1 crudo en vez de
// true/false — lo normalizamos acá (ver mismo fix en user.model.js) para
// que el checkbox de PlantillasTab.jsx y el "if (!plantilla.activo)" de
// mail.service.js reciban siempre un boolean de verdad.
function normalizar(row) {
  if (!row) return row;
  row.activo = Boolean(row.activo);
  return row;
}

async function listAll() {
  const rows = await db('email_templates').select('*').orderBy('nombre');
  return rows.map(normalizar);
}

async function findByClave(clave) {
  const row = await db('email_templates').where({ clave }).first();
  return normalizar(row);
}

async function updateByClave(clave, { asunto, cuerpo_html, activo }) {
  const patch = {};
  if (asunto !== undefined) patch.asunto = asunto;
  if (cuerpo_html !== undefined) patch.cuerpo_html = cuerpo_html;
  if (activo !== undefined) patch.activo = activo;
  patch.updated_at = db.fn.now();
  await db('email_templates').where({ clave }).update(patch);
  return findByClave(clave);
}

module.exports = { listAll, findByClave, updateByClave };
