// "Alertas": el admin le manda un mensaje de texto libre a uno o varios
// alumnos/profesores — aparece como pop-up al entrar (una sola vez) y
// después queda disponible en la pestaña "Alertas" del destinatario para
// volver a leerla. Una fila por destinatario (no una tabla de "envío" +
// otra de "destinatarios" aparte): la consulta que hace falta acá es
// siempre "¿qué le mandaron a ESTE usuario?", así que separar eso en dos
// tablas solo agregaría un join sin necesidad — mismo criterio que
// login_logs, que tampoco separa "sesión" de "quién se logueó".
exports.up = function (knex) {
  return knex.schema.createTable('alertas', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('admin_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.text('mensaje').notNullable();
    // NULL = todavía no se le mostró como pop-up. Se completa la primera
    // vez que el destinatario entra después de que se la mandaron — a
    // partir de ahí sigue viendo el mensaje en su pestaña "Alertas", pero
    // no vuelve a aparecer como pop-up (ver alerta.model.js).
    table.timestamp('mostrado_en');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('alertas');
};
