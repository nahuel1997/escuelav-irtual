exports.up = function (knex) {
  return knex.schema.createTable('chat_messages', (table) => {
    table.increments('id').primary();
    table.integer('conversation_id').unsigned().notNullable().references('id').inTable('chat_conversations').onDelete('CASCADE');
    table.string('remitente_tipo').notNullable(); // usuario | soporte
    table.integer('remitente_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('cuerpo').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['conversation_id', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chat_messages');
};
