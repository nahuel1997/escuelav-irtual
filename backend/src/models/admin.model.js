// Queries agregadas para el dashboard del panel de administración. Viven
// en su propio model (en vez de mezclarse en user/course/enrollment)
// porque combinan varias tablas con un propósito puntual: las métricas
// que pidió mostrar el admin.
const db = require('../config/db');
const userModel = require('./user.model');
const enrollmentModel = require('./enrollment.model');

// Por cada profesor: cuántos cursos dicta, y cuántas entregas de sus
// alumnos ya revisó (o tiene pendientes). Esto cubre a la vez "lista de
// profesores" y "tareas revisadas por los profesores".
async function estadisticasProfesores() {
  const filas = await db('users as u')
    .where('u.rol', 'profesor')
    .leftJoin('courses as c', 'c.profesor_id', 'u.id')
    .leftJoin('assignments as a', 'a.profesor_id', 'u.id')
    .leftJoin('submissions as s', 's.assignment_id', 'a.id')
    .groupBy('u.id')
    .select(
      'u.id',
      'u.nombre',
      'u.apellido',
      'u.email',
      db.raw('COUNT(DISTINCT c.id) as cursos'),
      db.raw("COUNT(DISTINCT CASE WHEN s.estado = 'revisado' THEN s.id END) as tareas_revisadas"),
      db.raw("COUNT(DISTINCT CASE WHEN s.estado = 'entregado' THEN s.id END) as tareas_pendientes")
    )
    .orderBy('u.nombre');

  return filas.map((f) => ({
    ...f,
    cursos: Number(f.cursos),
    tareas_revisadas: Number(f.tareas_revisadas),
    tareas_pendientes: Number(f.tareas_pendientes),
  }));
}

async function dashboard() {
  const [cursosVendidos, alumnos, cursosCompletados, profesores] = await Promise.all([
    enrollmentModel.countTotal(),
    userModel.countByRole('alumno'),
    enrollmentModel.countCompletados(),
    estadisticasProfesores(),
  ]);

  const tareasRevisadasTotal = profesores.reduce((acc, p) => acc + p.tareas_revisadas, 0);

  return {
    cursosVendidos: Number(cursosVendidos.count),
    alumnos: Number(alumnos.count),
    cursosCompletados: Number(cursosCompletados.count),
    tareasRevisadasTotal,
    profesores,
  };
}

module.exports = { dashboard, estadisticasProfesores };
