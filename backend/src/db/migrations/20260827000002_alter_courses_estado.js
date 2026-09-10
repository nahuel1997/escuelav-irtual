// Estado del curso (columna courses.estado), elegido por el admin desde
// /admin-panel/cursos. Valores válidos en src/config/estadosCurso.js:
//   'subido'        → visible en la tienda y comprable (default, incluidas
//                      todas las filas ya existentes).
//   'en_revision'    → no aparece en la tienda ni se puede comprar.
//   'cancelado'      → no aparece en la tienda ni se puede comprar, pero un
//                      alumno que ya lo tenía comprado sigue con acceso
//                      normal al classroom.
//   'fuera_sistema'  → no lo ve nadie, ni siquiera un alumno que ya lo
//                      había comprado (ver checkVerAcceso/checkAccess).
exports.up = function (knex) {
  return knex.schema.alterTable('courses', (table) => {
    table.string('estado').notNullable().defaultTo('subido');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('courses', (table) => {
    table.dropColumn('estado');
  });
};
