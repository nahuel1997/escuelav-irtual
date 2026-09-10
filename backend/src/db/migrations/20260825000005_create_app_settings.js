// Configuración general editable desde el backoffice, guardada como
// clave/valor (mismo patrón que site_content: nada de constantes
// hardcodeadas en el código para números que el admin va a querer tocar
// sin pedir un deploy). Por ahora la usan los umbrales de los mails
// automáticos (días de inactividad, horas de carrito abandonado, minutos
// de anticipación del recordatorio de turno, remitente de los mails).
exports.up = function (knex) {
  return knex.schema.createTable('app_settings', (table) => {
    table.increments('id').primary();
    table.string('clave').notNullable().unique();
    table.string('valor').notNullable();
    table.string('descripcion');
    table.timestamps(true, true);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('app_settings');
};
