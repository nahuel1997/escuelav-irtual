exports.up = function (knex) {
  return knex.schema.createTable('submissions', (table) => {
    table.increments('id').primary();
    table.integer('assignment_id').unsigned().notNullable().references('id').inTable('assignments').onDelete('CASCADE');
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('archivo_path').notNullable();
    table.string('archivo_nombre_original');
    table.text('comentario_alumno');
    table.enu('estado', ['entregado', 'revisado']).notNullable().defaultTo('entregado');
    table.decimal('calificacion', 4, 2);
    table.text('feedback_profesor');
    table.timestamp('entregado_at').defaultTo(knex.fn.now());
    table.timestamp('revisado_at');
    table.unique(['assignment_id', 'user_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('submissions');
};
