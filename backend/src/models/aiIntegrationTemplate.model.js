// Capa de acceso a los instructivos de "Integraciones IA" — mismo patrón
// exacto que cvAiTemplate.model.js.
const db = require('../config/db');

function normalizar(row) {
  if (!row) return row;
  return { ...row, activo: !!row.activo };
}

function listAll() {
  return db('ai_integration_templates').orderBy('clave').select('*').then((rows) => rows.map(normalizar));
}

function findByClave(clave) {
  return db('ai_integration_templates').where({ clave }).first().then(normalizar);
}

async function updateByClave(clave, { nombre, instructivo_html, activo }) {
  const cambios = { updated_at: db.fn.now() };
  if (nombre !== undefined) cambios.nombre = nombre;
  if (instructivo_html !== undefined) cambios.instructivo_html = instructivo_html;
  if (activo !== undefined) cambios.activo = activo;
  await db('ai_integration_templates').where({ clave }).update(cambios);
  return findByClave(clave);
}

module.exports = { listAll, findByClave, updateByClave };
