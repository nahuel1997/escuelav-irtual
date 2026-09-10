// Integración LMS real (LTI 1.3, ver docs/LTI.md): esta app actúa como
// "Tool" — el LMS (Moodle, Canvas, Google Classroom, cualquiera
// compatible con LTI Advantage) es la "Platform" que nos lanza. Para eso
// necesitamos NUESTRO PROPIO par de claves RSA: la privada firma los
// pedidos de token que le hacemos a la plataforma (para el passback de
// notas vía AGS), la pública la exponemos en /api/lti/jwks para que la
// plataforma pueda verificar esas firmas.
//
// Se genera sola la primera vez que hace falta (ver
// services/lti/keys.service.js) — no hace falta que el admin cargue nada
// a mano ni pegue ningún secreto en el .env.
exports.up = function (knex) {
  return knex.schema.createTable('lti_tool_keys', (table) => {
    table.increments('id').primary();
    table.string('kid').notNullable().unique();
    table.text('private_key_pem').notNullable();
    table.text('public_key_pem').notNullable();
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lti_tool_keys');
};
