// Historial completo de intentos de login (exitosos, fallidos, rebotados
// por espera, por IP bloqueada, por cuenta inactiva/bloqueada). Distinto de
// login_logs (que son las SESIONES abiertas, con su jti) y de
// login_intentos (que es solo el contador de la racha de fallos para la
// fuerza bruta, y se borra en cada login exitoso). Acá no se borra nada:
// es lo que el admin mira en Sesiones → "Intentos de ingreso" para ver
// quién está probando contraseñas y desde dónde (mismo registro que el
// "Historial de logueo" de DBA24).
exports.up = function (knex) {
  return knex.schema.createTable('login_eventos', (table) => {
    table.increments('id').primary();
    // Email tal cual se intentó (normalizado) — puede no existir ninguna
    // cuenta con ese email, por eso no es FK.
    table.string('email');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.string('ip');
    table.string('user_agent');
    // exitoso | fallido | espera | ip_bloqueada | inactivo | bloqueado | bloqueo_ip
    table.string('resultado').notNullable();
    table.string('detalle');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['created_at']);
    table.index(['ip']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('login_eventos');
};
