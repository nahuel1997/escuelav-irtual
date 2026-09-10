// Profesores asignados a una clase en vivo — tabla puente porque una
// clase puede ser co-dictada por más de un profesor (el admin decide
// quiénes al armarla, ver liveClasses.controller.js), y CUALQUIERA de los
// asignados puede iniciar/finalizar la transmisión, no hace falta que
// coincida con el profesor "dueño" del curso (courses.profesor_id) — por
// ejemplo, para invitar a un profesor de otro curso a dar una clase
// puntual.
exports.up = function (knex) {
  return knex.schema.createTable('live_class_profesores', (table) => {
    table.increments('id').primary();
    table.integer('live_class_id').unsigned().notNullable().references('id').inTable('live_classes').onDelete('CASCADE');
    table.integer('profesor_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['live_class_id', 'profesor_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('live_class_profesores');
};
