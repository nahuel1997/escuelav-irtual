// El Creador de CV (frontend/src/pages/CvBuilder.jsx) hasta ahora era
// puramente "de sesión": cada vez que el alumno entraba tenía que volver a
// tipear sus datos personales y toda su experiencia laboral, porque nada
// se guardaba — el PDF se generaba al vuelo y ahí terminaba todo. Esta
// tabla le da a cada usuario UN perfil de CV persistente (1 a 1 con
// users, por eso el unique en user_id) que se precarga solo al volver a
// entrar y se pisa entero cada vez que guarda o descarga el PDF.
//
// Las listas (experiencia, educación, habilidades, idiomas) son de largo
// variable y no se consultan nunca por columna individual (no hace falta
// filtrar "dame los CV con experiencia en tal empresa"), así que en vez de
// tablas normalizadas aparte se guardan como JSON en columnas de texto —
// mismo criterio que ya usa el proyecto en paymentOrder.model.js (items)
// y apiClient.model.js (columnas).
exports.up = function (knex) {
  return knex.schema.createTable('cv_profiles', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.string('nombre_completo');
    table.string('email');
    table.string('telefono');
    table.string('ubicacion');
    table.string('linkedin');
    table.text('resumen_profesional');
    table.text('experiencia').notNullable().defaultTo('[]'); // JSON: [{puesto, empresa, periodo, descripcion}]
    table.text('educacion').notNullable().defaultTo('[]'); // JSON: [{titulo, institucion, periodo}]
    table.text('habilidades').notNullable().defaultTo('[]'); // JSON: ["Excel avanzado", ...]
    table.text('idiomas').notNullable().defaultTo('[]'); // JSON: [{idioma, nivel}]
    table.boolean('incluir_cursos_plataforma').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('cv_profiles');
};
