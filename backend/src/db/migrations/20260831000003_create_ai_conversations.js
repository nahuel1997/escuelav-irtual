// Conversaciones de la pestaña "Chats": a diferencia del Sandbox de
// agentes (un flujo = una corrida, sin historial persistente), acá cada
// alumno puede tener VARIAS conversaciones separadas con la misma IA
// (como en ChatGPT/Claude reales) — cada fila es un hilo, sus mensajes
// van en ai_messages (tabla aparte, ver la migración siguiente).
exports.up = function (knex) {
  return knex.schema.createTable('ai_conversations', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('proveedor').notNullable(); // 'chatgpt' | 'claude' | 'gemini'
    table.string('titulo').notNullable().defaultTo('Nueva conversación');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['user_id', 'proveedor']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ai_conversations');
};
