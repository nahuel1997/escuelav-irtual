// Marca de si ya se mandó el recordatorio de "tu turno es en 30 minutos"
// para este evento, así el job que lo revisa cada pocos minutos
// (jobs/recordatorioCitas.job.js) no lo manda dos veces.
exports.up = function (knex) {
  return knex.schema.alterTable('calendar_events', (table) => {
    table.timestamp('recordatorio_enviado_at');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('calendar_events', (table) => {
    table.dropColumn('recordatorio_enviado_at');
  });
};
