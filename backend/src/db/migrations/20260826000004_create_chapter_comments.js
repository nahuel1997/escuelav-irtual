// Caja de comentarios de cada capítulo: cualquiera con acceso al classroom
// del curso (alumno inscripto o profesor dueño) puede comentar.
exports.up = function (knex) {
  return knex.schema.createTable('chapter_comments', (table) => {
    table.increments('id').primary();
    table.integer('chapter_id').unsigned().notNullable().references('id').inTable('course_chapters').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.text('texto').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chapter_comments');
};
