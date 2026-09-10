exports.up = function (knex) {
  return knex.schema.createTable('achievements', (table) => {
    table.increments('id').primary();
    table.string('codigo').notNullable().unique();
    table.string('titulo').notNullable();
    table.text('descripcion');
    table.string('icono').defaultTo('🏆');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('achievements');
};
