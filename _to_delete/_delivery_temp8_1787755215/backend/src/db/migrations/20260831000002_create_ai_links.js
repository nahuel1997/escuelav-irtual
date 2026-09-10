// Vinculación de cada alumno con su PROPIA cuenta de IA: la API key que
// carga en la pestaña "Vinculaciones" se guarda cifrada (ver
// utils/crypto.js — AES-256-GCM, nunca en texto plano) y se usa
// server-side solo para reenviar sus mensajes a esa IA en su nombre
// (services/aiChat/) — nunca se devuelve descifrada a ningún endpoint,
// solo un preview corto (últimos 4 caracteres, ver api_key_preview) para
// que el alumno pueda confirmar qué key tiene cargada sin volver a verla
// entera.
//
// "activo" (no un DELETE al desvincular) es a propósito: el historial de
// chats de esa IA (ai_conversations) no se borra al desvincular, solo deja
// de listarse hasta que se vuelva a vincular — ver aiLink.model.js.
exports.up = function (knex) {
  return knex.schema.createTable('ai_links', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('proveedor').notNullable(); // 'chatgpt' | 'claude' | 'gemini'
    table.text('api_key_encriptada').notNullable();
    table.string('api_key_preview').notNullable();
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['user_id', 'proveedor']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ai_links');
};
