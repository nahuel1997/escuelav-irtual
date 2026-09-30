// Tickets de soporte (portado de los tickets de DBA24): una consulta con
// hilo de mensajes, adjuntos privados, estado, prioridad, asignación a un
// agente (soporte o admin) y etiquetas. Complementa al chat en vivo: el
// chat es para lo inmediato, el ticket para lo que necesita seguimiento.
//
// ticket_aprobaciones: "necesitamos tu aprobación" — se manda por mail un
// link con token (sin login) para aprobar o rechazar; solo se guarda el
// hash del token.
exports.up = async function (knex) {
  await knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('asunto').notNullable();
    table.string('categoria');
    table.string('prioridad').notNullable().defaultTo('media'); // baja | media | alta
    // abierto | en_curso | esperando_usuario | resuelto | cerrado
    table.string('estado').notNullable().defaultTo('abierto');
    table.integer('asignado_a').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('origen').notNullable().defaultTo('portal');
    table.timestamp('cerrado_en');
    table.timestamps(true, true);
    table.index(['estado']);
    table.index(['user_id']);
  });

  await knex.schema.createTable('ticket_mensajes', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('autor_rol', 20);
    table.text('mensaje').notNullable();
    // Nota interna del equipo: el alumno/profesor nunca la ve.
    table.boolean('interno').notNullable().defaultTo(false);
    // Cambios automáticos (estado, asignación) que quedan en el hilo.
    table.boolean('sistema').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('ticket_adjuntos', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    table.integer('mensaje_id').unsigned().references('id').inTable('ticket_mensajes').onDelete('CASCADE');
    table.string('archivo').notNullable();
    table.string('nombre_original');
    table.string('mime');
    table.integer('tamano');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('ticket_etiquetas', (table) => {
    table.increments('id').primary();
    table.string('nombre').notNullable().unique();
    table.string('color').notNullable().defaultTo('#1c3d5a');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('ticket_etiqueta', (table) => {
    table.integer('ticket_id').unsigned().notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    table.integer('etiqueta_id').unsigned().notNullable().references('id').inTable('ticket_etiquetas').onDelete('CASCADE');
    table.primary(['ticket_id', 'etiqueta_id']);
  });

  await knex.schema.createTable('ticket_aprobaciones', (table) => {
    table.increments('id').primary();
    table.integer('ticket_id').unsigned().notNullable().references('id').inTable('tickets').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.text('detalle').notNullable();
    table.string('estado').notNullable().defaultTo('pendiente'); // pendiente | aprobado | rechazado
    table.text('comentario');
    table.integer('creado_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('expira_en').notNullable();
    table.timestamp('respondido_en');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ticket_aprobaciones');
  await knex.schema.dropTableIfExists('ticket_etiqueta');
  await knex.schema.dropTableIfExists('ticket_etiquetas');
  await knex.schema.dropTableIfExists('ticket_adjuntos');
  await knex.schema.dropTableIfExists('ticket_mensajes');
  await knex.schema.dropTableIfExists('tickets');
};
