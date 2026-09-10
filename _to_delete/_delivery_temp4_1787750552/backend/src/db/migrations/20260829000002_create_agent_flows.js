// Sandbox de orquestación de agentes: cada alumno/profesor arma "flujos"
// (una secuencia de agentes de IA, cada uno con su rol/instrucciones y un
// proveedor asignado) y los puede "ejecutar" para ver cómo se pasarían
// información entre sí. Por ahora la ejecución es 100% SIMULADA (ver
// services/agentProviders/) — no se llama a ninguna IA real, no hay costo
// ni hace falta ninguna API key.
//
// Igual que cv_profiles, un flujo se lee y se guarda siempre entero (el
// editor manda el arreglo completo de nodos cada vez), así que los nodos
// van como JSON en una columna de texto en vez de una tabla aparte — no
// hay ningún caso de uso que necesite consultar "todos los nodos con
// proveedor X" cruzando flujos. El ORDEN del arreglo ES el orden de
// ejecución (cadena secuencial: la salida de un nodo es el contexto de
// entrada del siguiente) — ver agentOrchestrator.service.js.
exports.up = function (knex) {
  return knex.schema.createTable('agent_flows', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('nombre').notNullable();
    table.text('descripcion');
    table.text('nodos').notNullable().defaultTo('[]'); // JSON: [{id, nombre, rol, instrucciones, proveedor}]
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.index(['user_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('agent_flows');
};
