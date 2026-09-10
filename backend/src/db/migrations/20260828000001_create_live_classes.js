// Clases en vivo: una fila por cada transmisión programada para un curso.
// `room_id` es un slug random (no correlativo, no el id numérico) para que
// nadie pueda "adivinar" la sala de otra clase — igual la API solo lo
// revela cuando corresponde (ver liveClasses.controller.js::getSala): al
// profesor asignado siempre, al alumno inscripto recién cuando la clase
// está "en_vivo".
//
// `estado` es la máquina de estados completa: 'programada' (default, al
// crearla) → 'en_vivo' (el profesor asignado la inició) → 'finalizada'
// (el profesor la cerró) — o 'cancelada' en cualquier momento antes de
// terminar (el admin la canceló). No hay vuelta atrás entre estados: una
// clase cancelada o finalizada no vuelve a "programada".
exports.up = function (knex) {
  return knex.schema.createTable('live_classes', (table) => {
    table.increments('id').primary();
    table.integer('course_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.string('titulo').notNullable();
    table.text('descripcion');
    table.timestamp('scheduled_at').notNullable();
    table.integer('duracion_minutos').notNullable().defaultTo(60);
    table.string('estado').notNullable().defaultTo('programada'); // programada | en_vivo | finalizada | cancelada
    table.string('room_id').notNullable().unique();
    // El admin que la creó — nullable con SET NULL: si esa cuenta de admin
    // se borrara algún día, la clase (e historial de mensajes) no tiene
    // por qué desaparecer con ella.
    table.integer('creado_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('started_at');
    table.timestamp('ended_at');
    table.timestamps(true, true);
    table.index(['course_id']);
    table.index(['estado']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('live_classes');
};
