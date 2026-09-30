// Listas blancas de admins para secciones sensibles (Backups y
// Actualizaciones, cada una con su propia tabla — tener acceso a una no da
// acceso a la otra, igual que en DBA24). No alcanza con esconder el ítem
// del menú: el backend lo chequea en cada request.
//
// Arranque: si la lista está VACÍA, cualquier admin puede entrar (si no,
// nadie podría dar de alta al primero); el panel avisa que conviene
// cargarla. Apenas tiene alguien, solo entran los de la lista.
const db = require('../config/db');
const { AppError } = require('./error.middleware');

const TABLAS = { backups: 'backups_admins', actualizaciones: 'actualizaciones_admins' };

async function tieneAcceso(seccion, userId) {
  const tabla = TABLAS[seccion];
  const total = await db(tabla).count({ c: '*' }).first();
  if (Number(total.c) === 0) return { acceso: true, listaVacia: true };
  const fila = await db(tabla).where({ user_id: userId }).first();
  return { acceso: Boolean(fila), listaVacia: false };
}

function requerirListaBlanca(seccion) {
  return async (req, res, next) => {
    try {
      const { acceso } = await tieneAcceso(seccion, req.user.id);
      if (!acceso) return next(new AppError('No estás habilitado para esta sección. Pedile acceso a un admin de la lista.', 403));
      next();
    } catch (err) {
      next(err);
    }
  };
}

function listar(seccion) {
  return db(`${TABLAS[seccion]} as l`)
    .join('users as u', 'u.id', 'l.user_id')
    .select('l.id', 'l.user_id', 'l.created_at', 'u.nombre', 'u.apellido', 'u.email');
}

async function agregar(seccion, userId, agregadoPor) {
  const u = await db('users').where({ id: userId }).first();
  if (!u || u.rol !== 'admin') throw new AppError('Solo se puede agregar a un usuario admin', 400);
  const tabla = TABLAS[seccion];
  if (!(await db(tabla).where({ user_id: userId }).first())) await db(tabla).insert({ user_id: userId, agregado_por: agregadoPor });
}

async function quitar(seccion, id, userIdQuePide) {
  const tabla = TABLAS[seccion];
  const fila = await db(tabla).where({ id }).first();
  if (!fila) throw new AppError('No encontrado', 404);
  const total = Number((await db(tabla).count({ c: '*' }).first()).c);
  // Evita dejarse afuera a uno mismo siendo el último (quedaría vacía =
  // abierta a todos los admins, que no es lo que se quiere al "quitar").
  if (fila.user_id === userIdQuePide && total === 1) throw new AppError('Sos el único de la lista: agregá a otro admin antes de quitarte', 400);
  await db(tabla).where({ id }).del();
}

module.exports = { requerirListaBlanca, tieneAcceso, listar, agregar, quitar };
