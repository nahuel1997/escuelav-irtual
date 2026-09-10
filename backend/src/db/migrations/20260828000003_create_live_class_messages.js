// Historial de mensajes del chat de una clase en vivo. Es una bitácora
// simple (no hay edición ni borrado de mensajes): cada fila es un mensaje
// que ya se emitió por socket (ver realtime/liveClassSocket.js), guardado
// acá para que quien entra tarde a la sala pueda ver lo que se habló antes
// (mismo patrón que chat_messages / chatMessage.model.js).
exports.up = function (knex) {
  return knex.schema.createTable('live_class_messages', (table) => {
    table.increments('id').primary();
    table.integer('live_class_id').unsigned().notNullable().references('id').inTable('live_classes').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('cuerpo').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['live_class_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('live_class_messages');
};
