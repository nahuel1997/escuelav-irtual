exports.up = function (knex) {
  return knex.schema.createTable('contact_messages', (table) => {
    table.increments('id').primary();
    table.string('nombre').notNullable();
    table.string('email').notNullable();
    table.string('telefono');
    table.text('mensaje').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('contact_messages');
};
