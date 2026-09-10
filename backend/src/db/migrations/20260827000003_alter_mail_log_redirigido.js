// Cuando el "modo prueba" de mails está activo (app_settings.
// mail_modo_prueba_destinatario, ver seed 002_email_templates.js y
// mail.service.js), todo mail se manda de verdad a esa casilla de prueba
// en vez del destinatario real — pero seguimos queriendo saber para quién
// era en realidad. redirigido_desde guarda ese destinatario original;
// queda null en un envío normal (sin redirección).
exports.up = function (knex) {
  return knex.schema.alterTable('mail_log', (table) => {
    table.string('redirigido_desde');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('mail_log', (table) => {
    table.dropColumn('redirigido_desde');
  });
};
