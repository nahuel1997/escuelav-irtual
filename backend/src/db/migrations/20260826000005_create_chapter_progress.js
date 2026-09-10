// Progreso de visualización de cada alumno por capítulo. Guardamos el
// segundo máximo alcanzado (no el último reportado) para que adelantar el
// video con el mouse y después volver atrás no le "baje" el progreso ya
// ganado, y para no poder falsear el 80% quedándose repitiendo los
// primeros segundos. `completado` es una acción explícita del alumno
// ("marcar como visto"), no algo que se ponga en true solo, para que un
// autoplay descuidado no cuente como capítulo terminado.
exports.up = function (knex) {
  return knex.schema.createTable('chapter_progress', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('chapter_id').unsigned().notNullable().references('id').inTable('course_chapters').onDelete('CASCADE');
    table.integer('segundos_vistos_max').notNullable().defaultTo(0);
    table.integer('duracion_segundos'); // Duración total reportada por el reproductor (YouTube/Vimeo).
    table.integer('porcentaje_visto').notNullable().defaultTo(0);
    table.boolean('completado').notNullable().defaultTo(false);
    table.timestamp('completado_at');
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'chapter_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('chapter_progress');
};
