// Suma a "users" lo necesario para el flujo de validación de cuenta por
// mail (código de 6 dígitos) y para el mail de inactividad ("te
// extrañamos"). El registro público sigue logueando al usuario al toque
// (no bloqueamos el login por no estar verificado, ver auth.controller.js)
// — email_verificado es informativo/de confianza, no un gate de acceso.
exports.up = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.boolean('email_verificado').notNullable().defaultTo(false);
    table.timestamp('email_verificado_at');
    // Marca de la última vez que se envió el mail de "te extrañamos" a este
    // usuario, para que el job de inactividad no lo reenvíe todos los días
    // mientras la cuenta siga inactiva (ver jobs/inactividad.job.js).
    table.timestamp('ultimo_mail_inactividad_at');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verificado');
    table.dropColumn('email_verificado_at');
    table.dropColumn('ultimo_mail_inactividad_at');
  });
};
