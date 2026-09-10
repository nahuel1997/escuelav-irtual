// Turnos entre alumno y profesor (ej: consultas 1 a 1). El alumno solicita
// un horario, el profesor lo acepta o lo rechaza. "estado" queda como
// string plano (no enum) por la misma razón que "users.rol": SQLite no
// permite alterar un CHECK constraint más adelante si hiciera falta sumar
// un estado nuevo, así que la validez se controla en la capa de aplicación
// (ver controllers/calendar.controller.js).
exports.up = function (knex) {
  return knex.schema.createTable('calendar_events', (table) => {
    table.increments('id').primary();
    table.integer('alumno_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('profesor_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('course_id').unsigned().references('id').inTable('courses').onDelete('SET NULL');
    table.string('motivo').notNullable();
    table.timestamp('starts_at').notNullable();
    table.timestamp('ends_at').notNullable();
    table.string('estado').notNullable().defaultTo('pendiente'); // pendiente | aceptada | rechazada | cancelada
    table.text('notas_alumno');
    table.text('notas_profesor');
    table.timestamps(true, true);

    // Acelera el chequeo de superposición de horarios, que siempre filtra
    // por profesor + rango de fechas.
    table.index(['profesor_id', 'starts_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('calendar_events');
};
