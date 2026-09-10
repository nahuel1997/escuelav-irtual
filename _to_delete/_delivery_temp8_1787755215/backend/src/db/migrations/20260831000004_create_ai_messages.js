// Mensajes de cada conversación de "Integraciones IA" (rol 'user' o
// 'assistant', igual que el formato que ya esperan las APIs reales de
// OpenAI/Anthropic/Gemini — ver services/aiChat/). onDelete('CASCADE'):
// borrar una conversación (DELETE /ai/conversaciones/:id) se lleva sus
// mensajes solo, sin acordarse a mano de limpiarlos.
exports.up = function (knex) {
  return knex.schema.createTable('ai_messages', (table) => {
    table.increments('id').primary();
    table.integer('conversation_id').unsigned().notNullable().references('id').inTable('ai_conversations').onDelete('CASCADE');
    table.string('rol').notNullable(); // 'user' | 'assistant'
    table.text('contenido').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['conversation_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ai_messages');
};
