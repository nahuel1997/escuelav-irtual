exports.up = function (knex) {
  return knex.schema.createTable('assignments', (table) => {
    table.increments('id').primary();
    table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.integer('profesor_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('titulo').notNullable();
    table.text('descripcion').notNullable();
    table.date('fecha_entrega');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('assignments');
};
