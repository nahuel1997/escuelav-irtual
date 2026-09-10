exports.up = function (knex) {
  return knex.schema.createTable('courses', (table) => {
    table.increments('id').primary();
    table.string('titulo').notNullable();
    table.text('descripcion').notNullable();
    table.decimal('precio', 10, 2).notNullable().defaultTo(0);
    table.string('categoria');
    table.string('imagen_url');
    table.integer('profesor_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('courses');
};
