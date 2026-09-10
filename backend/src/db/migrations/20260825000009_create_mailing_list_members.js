exports.up = function (knex) {
  return knex.schema.createTable('mailing_list_members', (table) => {
    table.increments('id').primary();
    table.integer('mailing_list_id').unsigned().notNullable().references('id').inTable('mailing_lists').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('added_at').defaultTo(knex.fn.now());
    table.unique(['mailing_list_id', 'user_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('mailing_list_members');
};
