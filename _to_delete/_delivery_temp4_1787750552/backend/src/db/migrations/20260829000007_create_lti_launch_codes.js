// El launch de LTI llega como un POST del navegador del LMS directo a
// nuestro backend (no al frontend de React) — así que una vez que
// validamos todo y sabemos quién es el usuario, tenemos que "entregarle"
// una sesión al frontend con un redirect. Poner el JWT de sesión directo
// en la URL de ese redirect quedaría en el historial del navegador y en
// logs — en cambio generamos un código de un solo uso, de corta vida,
// redirigimos al frontend con SOLO el código, y el frontend lo cambia por
// el token real con un POST aparte (ver POST /api/lti/exchange).
exports.up = function (knex) {
  return knex.schema.createTable('lti_launch_codes', (table) => {
    table.increments('id').primary();
    table.string('code').notNullable().unique();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('redirect_to').notNullable(); // Ruta del frontend a la que entrar después (ej: /classroom/5).
    table.boolean('usado').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('lti_launch_codes');
};
