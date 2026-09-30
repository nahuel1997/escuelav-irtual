// IPs bloqueadas — tabla separada de "users.bloqueado" a propósito: acá
// se bloquea una conexión, no necesariamente una cuenta (una IP puede
// estar intentando loguearse contra emails que ni existen). Se llena por
// dos vías, que conviven sin pisarse: a mano desde el admin, o sola por
// el sistema de fuerza bruta del login (ver login_intentos y
// auth.controller.js) — ambas hacen upsert por "ip" (bloquear dos veces
// la misma IP no duplica fila, solo actualiza motivo/fecha).
exports.up = function (knex) {
  return knex.schema.createTable('ips_bloqueadas', (table) => {
    table.increments('id').primary();
    table.string('ip').notNullable().unique();
    table.text('motivo').notNullable();
    // Null = bloqueo automático (fuerza bruta). Si el admin que bloqueó
    // se borra después, el registro sigue existiendo (no tiene sentido
    // perder el bloqueo por eso) — por eso SET NULL y no CASCADE.
    table.integer('bloqueado_por').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('ips_bloqueadas');
};
