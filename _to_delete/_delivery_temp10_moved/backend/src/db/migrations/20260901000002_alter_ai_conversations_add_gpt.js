// Una conversación puede nacer "desde" un GPT propio (ver
// create_ai_gpts). Dos columnas, con roles distintos a propósito:
// - gpt_id: solo para MOSTRAR de qué GPT vino (ON DELETE SET NULL —
//   borrar el GPT no borra ni rompe sus conversaciones viejas).
// - sistema_prompt: una FOTO de instrucciones+conocimiento del GPT en el
//   momento exacto de crear la conversación, no una referencia viva. Así,
//   editar o borrar el GPT después nunca cambia retroactivamente cómo
//   responde una conversación ya empezada — mismo criterio que un Custom
//   GPT real: la conversación sigue con el comportamiento que tenía al
//   arrancarla, aunque el GPT "original" cambie o desaparezca (ver
//   ai.controller.js::mandarMensaje, usa esta columna directo, nunca hace
//   join a ai_gpts para no tener esa dependencia viva).
exports.up = function (knex) {
  return knex.schema.alterTable('ai_conversations', (table) => {
    table.integer('gpt_id').unsigned().nullable().references('id').inTable('ai_gpts').onDelete('SET NULL');
    table.text('sistema_prompt').nullable();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('ai_conversations', (table) => {
    table.dropColumn('gpt_id');
    table.dropColumn('sistema_prompt');
  });
};
