// Suma a "users" lo necesario para separar dos mecanismos independientes
// (ver README, sección "Seguridad de cuentas"):
// - activo: alta/baja de cuenta a mano por el admin. Un usuario inactivo
//   no puede loguearse, pero todo su historial (cursos, comentarios,
//   turnos) se conserva intacto — no es un borrado.
// - bloqueado: medida de seguridad. Se puede activar a mano (con motivo
//   libre) o automáticamente por el sistema de fuerza bruta del login
//   (ver login_intentos/ips_bloqueadas y auth.controller.js) sin que el
//   admin tenga que hacer nada. Son conceptos separados a propósito: el
//   sistema automático puede bloquear una cuenta sin pisar la decisión
//   administrativa de alta/baja, y viceversa.
exports.up = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.boolean('activo').notNullable().defaultTo(true);
    table.boolean('bloqueado').notNullable().defaultTo(false);
    table.text('bloqueado_motivo');
    table.timestamp('bloqueado_en');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('activo');
    table.dropColumn('bloqueado');
    table.dropColumn('bloqueado_motivo');
    table.dropColumn('bloqueado_en');
  });
};
