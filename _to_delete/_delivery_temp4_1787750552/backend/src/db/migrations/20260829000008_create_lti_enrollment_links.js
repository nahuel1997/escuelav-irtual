// Guarda, por cada inscripción que se creó/confirmó vía un launch de LTI,
// el "line item" (la columna de notas puntual dentro de esa plataforma)
// que la plataforma nos pasó en el claim de AGS del id_token — es lo que
// necesitamos para poder mandarle una nota de vuelta más adelante (ver
// services/lti/ags.service.js y el hook en classroom.controller.js al
// marcar un curso completado). Si el launch no traía ese claim (la
// plataforma no habilitó AGS para ese link), lineitem_url queda null y
// simplemente no se manda passback — el resto de la app sigue andando
// igual.
exports.up = function (knex) {
  return knex.schema.createTable('lti_enrollment_links', (table) => {
    table.increments('id').primary();
    table.integer('enrollment_id').unsigned().notNullable().references('id').inTable('enrollments').onDelete('CASCADE');
    table.integer('platform_id').unsigned().notNullable().references('id').inTable('lti_platforms').onDelete('CASCADE');
    table.string('lti_sub').notNullable();
    table.string('lineitem_url');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['enrollment_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lti_enrollment_links');
};
