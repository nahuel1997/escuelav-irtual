// Configuración de avance del curso, elegida por el profesor/admin:
// - modo_avance: cómo se van desbloqueando los capítulos para el alumno.
//     'libre'      → puede ver cualquier capítulo de cualquier unidad.
//     'por_unidad' → puede empezar cualquier unidad por su primer
//                    capítulo; dentro de la unidad, cada capítulo
//                    desbloquea al siguiente.
//     'continuo'   → solo se desbloquea el capítulo siguiente al último
//                    visto, en todo el curso (ignora límites de unidad).
// - exigir_80_porciento: si está en true, un capítulo recién se puede
//     marcar como "visto" (y por lo tanto desbloquear el siguiente, en los
//     modos que no son libres) al haber visualizado el 80% del video. El
//     profesor/admin puede desactivarlo para no exigir ese mínimo.
exports.up = function (knex) {
  return knex.schema.alterTable('courses', (table) => {
    table.string('modo_avance').notNullable().defaultTo('libre');
    table.boolean('exigir_80_porciento').notNullable().defaultTo(true);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('courses', (table) => {
    table.dropColumn('modo_avance');
    table.dropColumn('exigir_80_porciento');
  });
};
