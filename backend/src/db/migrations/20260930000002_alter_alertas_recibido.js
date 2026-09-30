// Acuse de recibo de las alertas (como las alertas a consultores de DBA24):
// además de "se le mostró como pop-up" (mostrado_en), el destinatario puede
// marcar "Recibido" — el admin ve en el historial quién la leyó de verdad.
exports.up = function (knex) {
  return knex.schema.alterTable('alertas', (table) => {
    table.timestamp('recibido_en');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('alertas', (table) => {
    table.dropColumn('recibido_en');
  });
};
