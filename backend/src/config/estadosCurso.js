// Estados posibles de un curso (ver migración
// 20260827000002_alter_courses_estado.js). Solo el admin los cambia, desde
// /admin-panel/cursos. Se valida en admin.controller.js — a diferencia de
// categorias.js, acá SÍ rechazamos cualquier valor fuera de la lista: es
// un campo nuevo, no hay datos viejos que puedan quedar fuera de rango.
module.exports = ['subido', 'en_revision', 'cancelado', 'fuera_sistema'];
