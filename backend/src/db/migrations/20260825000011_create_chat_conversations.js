// Chat de soporte en vivo. Una conversación por "hilo" entre un alumno/
// profesor y el equipo de soporte — se crea sola con el primer mensaje que
// manda el usuario (ver chatSocket.js), no hace falta un endpoint separado
// para "abrir un chat".
//
// "atendido_por" es informativo, no una asignación exclusiva: el reparto
// de chats entre agentes de soporte es de cola compartida (cualquier
// agente ve y puede responder cualquier chat abierto), así que este campo
// solo guarda el último agente que respondió — sirve para el registro del
// admin ("quién la atendió"), no para bloquear a los demás agentes.
exports.up = function (knex) {
  return knex.schema.createTable('chat_conversations', (table) => {
    table.increments('id').primary();
    table.integer('usuario_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('estado').notNullable().defaultTo('abierto'); // abierto | cerrado
    table.integer('atendido_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('cerrado_at');
    table.timestamps(true, true);
    table.index(['estado']);
    table.index(['usuario_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chat_conversations');
};
