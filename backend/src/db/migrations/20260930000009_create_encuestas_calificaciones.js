// Encuesta de satisfacción configurable (alumnos, por curso), calificaciones
// internas de profesores con adjuntos (solo las ve el admin) y el registro
// de reenvíos de PDF por mail (tope de 15 por hora por usuario, como DBA24).
exports.up = async function (knex) {
  await knex.schema.createTable('encuesta_preguntas', (table) => {
    table.increments('id').primary();
    table.string('texto', 300).notNullable();
    table.string('tipo', 20).notNullable().defaultTo('escala'); // escala (1-5) | si_no | texto
    table.boolean('activa').notNullable().defaultTo(true);
    table.integer('orden').notNullable().defaultTo(0);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('encuesta_respuestas', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.integer('pregunta_id').unsigned().notNullable().references('id').inTable('encuesta_preguntas').onDelete('CASCADE');
    table.integer('valor');
    table.text('texto');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['user_id', 'course_id', 'pregunta_id']);
  });

  await knex('encuesta_preguntas').insert([
    { texto: '¿Qué tan satisfecho/a estás con el curso?', tipo: 'escala', orden: 1 },
    { texto: '¿Cómo calificarías al profesor?', tipo: 'escala', orden: 2 },
    { texto: '¿Recomendarías el curso?', tipo: 'si_no', orden: 3 },
    { texto: '¿Qué mejorarías?', tipo: 'texto', orden: 4 },
  ]);

  await knex.schema.createTable('profesor_calificaciones', (table) => {
    table.increments('id').primary();
    table.integer('profesor_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('admin_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.integer('puntaje').notNullable(); // 1 a 5
    table.string('criterio', 60).notNullable(); // puntualidad, contenido, trato, etc.
    table.text('comentario');
    table.date('fecha').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['profesor_id']);
  });

  await knex.schema.createTable('profesor_adjuntos', (table) => {
    table.increments('id').primary();
    table.integer('profesor_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('archivo').notNullable();
    table.string('nombre_original');
    table.string('mime');
    table.integer('tamano');
    table.integer('subido_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('envios_pdf', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('destinatario').notNullable();
    table.string('titulo');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['user_id', 'created_at']);
  });
};

exports.down = async function (knex) {
  for (const t of ['envios_pdf', 'profesor_adjuntos', 'profesor_calificaciones', 'encuesta_respuestas', 'encuesta_preguntas']) {
    await knex.schema.dropTableIfExists(t);
  }
};
