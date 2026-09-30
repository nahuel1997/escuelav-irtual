// Registro de errores de la app (servidor + navegador) y reportes de error
// de los usuarios — mismo diseño que errores_app / reportes de DBA24.
//
// errores_app: los errores iguales se agrupan por "huella" (mensaje sin
// números + ruta sin ids + lugar del stack): un error que se repite mil
// veces es una fila con veces = 1000, no mil filas.
//
// reportes_error: "Reportar error" de alumnos/profesores, con hasta 5
// capturas (guardadas en backend/privado/, nunca públicas) y un estado que
// maneja el admin en Errores → "Errores alertados".
exports.up = async function (knex) {
  await knex.schema.createTable('errores_app', (table) => {
    table.increments('id').primary();
    table.string('huella', 64).notNullable().unique();
    table.string('origen').notNullable(); // servidor | navegador
    table.text('mensaje').notNullable();
    table.text('stack');
    table.string('contexto');
    table.string('url', 500);
    table.string('metodo', 10);
    table.integer('usuario_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('usuario_nombre');
    table.string('rol', 20);
    table.string('navegador', 300);
    table.text('detalle'); // JSON
    table.integer('veces').notNullable().defaultTo(1);
    table.timestamp('primera_vez').defaultTo(knex.fn.now());
    table.timestamp('ultima_vez').defaultTo(knex.fn.now());
    table.index(['ultima_vez']);
  });

  await knex.schema.createTable('reportes_error', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('rol', 20);
    table.string('titulo').notNullable();
    table.text('descripcion').notNullable();
    table.string('pagina', 500);
    table.string('navegador', 300);
    // nuevo | en_revision | resuelto | descartado
    table.string('estado').notNullable().defaultTo('nuevo');
    table.text('respuesta');
    table.timestamps(true, true);
    table.index(['estado']);
  });

  await knex.schema.createTable('reportes_error_adjuntos', (table) => {
    table.increments('id').primary();
    table.integer('reporte_id').unsigned().notNullable().references('id').inTable('reportes_error').onDelete('CASCADE');
    table.string('archivo').notNullable();
    table.string('nombre_original');
    table.string('mime');
    table.integer('tamano');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('reportes_error_adjuntos');
  await knex.schema.dropTableIfExists('reportes_error');
  await knex.schema.dropTableIfExists('errores_app');
};
