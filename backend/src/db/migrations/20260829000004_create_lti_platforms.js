// Cada fila es UNA integración registrada por el admin: un LMS externo
// (identificado por su "issuer" + client_id + deployment_id, como pide el
// estándar LTI 1.3) conectado a UN curso puntual de la plataforma. No
// atamos esto a un LMS específico (Moodle/Canvas/Google Classroom) — LTI
// 1.3 es justamente el estándar que hace que no haga falta: cualquier
// plataforma compatible se registra igual, completando estos mismos
// campos (que son los que el admin de esa plataforma le va a pedir al
// admin de acá, y viceversa — ver AdminLti.jsx).
exports.up = function (knex) {
  return knex.schema.createTable('lti_platforms', (table) => {
    table.increments('id').primary();
    table.string('nombre').notNullable(); // Ej: "Moodle Instituto X" — solo para identificarla en el panel.
    table.string('issuer').notNullable();
    table.string('client_id').notNullable();
    table.string('deployment_id').notNullable();
    table.string('auth_login_url').notNullable(); // OIDC login endpoint de la plataforma.
    table.string('auth_token_url').notNullable(); // Token endpoint (lo usamos para pedir accesos de AGS).
    table.string('jwks_url').notNullable(); // Claves públicas de la plataforma, para validar sus id_tokens.
    table.integer('curso_id').unsigned().notNullable().references('id').inTable('courses').onDelete('CASCADE');
    table.boolean('activo').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['issuer', 'client_id', 'deployment_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lti_platforms');
};
