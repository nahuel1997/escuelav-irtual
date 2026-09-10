// Capa de acceso a las vinculaciones de cada alumno con su propia cuenta
// de IA (ver ai_links, utils/crypto.js). Dos formas de leer a propósito:
// listForUser (para el frontend, NUNCA incluye la key) y
// findConKeyParaUso (solo para el controller, al momento de llamar de
// verdad a la IA — ver ai.controller.js::mandarMensaje).
const db = require('../config/db');

function paraFrontend(row) {
  if (!row) return null;
  return {
    proveedor: row.proveedor,
    activo: !!row.activo,
    apiKeyPreview: row.api_key_preview,
    updatedAt: row.updated_at,
  };
}

function listForUser(userId) {
  return db('ai_links').where({ user_id: userId }).select('*').then((rows) => rows.map(paraFrontend));
}

function findConKeyParaUso(userId, proveedor) {
  return db('ai_links').where({ user_id: userId, proveedor }).first();
}

// Upsert manual (SQLite + Postgres, ver knexfile.js): si ya existe una
// vinculación para este alumno+proveedor (incluso desactivada), la pisa y
// reactiva en vez de duplicarla — volver a vincular con una key nueva
// simplemente reemplaza la anterior.
async function vincular(userId, proveedor, { apiKeyEncriptada, apiKeyPreview }) {
  const existente = await db('ai_links').where({ user_id: userId, proveedor }).first();
  if (existente) {
    await db('ai_links').where({ id: existente.id }).update({
      api_key_encriptada: apiKeyEncriptada,
      api_key_preview: apiKeyPreview,
      activo: true,
      updated_at: db.fn.now(),
    });
  } else {
    await db('ai_links').insert({ user_id: userId, proveedor, api_key_encriptada: apiKeyEncriptada, api_key_preview: apiKeyPreview, activo: true });
  }
  return paraFrontend(await db('ai_links').where({ user_id: userId, proveedor }).first());
}

// Desvincular NO borra el historial de conversaciones (ver
// ai_conversations): solo apaga el link. Los chats de ese proveedor dejan
// de listarse en Registros/Chats hasta que se vuelva a vincular (ver
// ai.controller.js::listarConversaciones) pero no se pierden.
function desvincular(userId, proveedor) {
  return db('ai_links').where({ user_id: userId, proveedor }).update({ activo: false, updated_at: db.fn.now() });
}

module.exports = { listForUser, findConKeyParaUso, vincular, desvincular };
