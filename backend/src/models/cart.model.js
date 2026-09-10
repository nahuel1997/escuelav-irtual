// Capa de acceso al carrito de compras (carts + cart_items). Un usuario
// tiene a lo sumo un carrito con estado 'activo' a la vez — obtenerOCrearActivo
// se encarga de eso (busca, y si no hay, crea). Cuando un carrito se marca
// 'convertido' (checkout) o 'abandonado' (job de carrito abandonado), el
// siguiente "agregar al carrito" arranca uno nuevo desde cero.
const db = require('../config/db');

async function obtenerOCrearActivo(userId) {
  let cart = await db('carts').where({ user_id: userId, estado: 'activo' }).first();
  if (!cart) {
    const [id] = await db('carts').insert({ user_id: userId, estado: 'activo' });
    cart = await db('carts').where({ id }).first();
  }
  return cart;
}

function listItems(cartId) {
  return db('cart_items as ci')
    .join('courses as c', 'c.id', 'ci.course_id')
    .where('ci.cart_id', cartId)
    .select('ci.id as item_id', 'ci.agregado_at', 'c.*')
    .orderBy('ci.agregado_at', 'desc');
}

async function agregarItem(cartId, courseId) {
  const yaEsta = await db('cart_items').where({ cart_id: cartId, course_id: courseId }).first();
  if (yaEsta) return yaEsta;
  const [id] = await db('cart_items').insert({ cart_id: cartId, course_id: courseId });
  return db('cart_items').where({ id }).first();
}

function quitarItem(cartId, courseId) {
  return db('cart_items').where({ cart_id: cartId, course_id: courseId }).del();
}

function vaciar(cartId) {
  return db('cart_items').where({ cart_id: cartId }).del();
}

function marcarConvertido(cartId) {
  return db('carts').where({ id: cartId }).update({ estado: 'convertido', convertido_at: db.fn.now(), updated_at: db.fn.now() });
}

// Usado al confirmar un pago real (ver checkout.service.js::finalizarOrden):
// si el curso recién comprado seguía en el carrito activo del alumno (lo
// más común, ya que el checkout con pago real no vacía el carrito hasta
// que el pago se confirma), lo saca de ahí. Subquery en vez de un DELETE
// con JOIN para que funcione igual en SQLite y Postgres. Silenciosamente
// no hace nada si no hay carrito activo o el curso no estaba — no es un
// error, solo puede pasar si el alumno lo compró directo (sin pasar por
// el carrito) o ya lo había sacado él mismo.
function quitarDeCarritoActivoSiExiste(userId, courseId) {
  return db('cart_items')
    .where('course_id', courseId)
    .whereIn('cart_id', function () {
      this.select('id').from('carts').where({ user_id: userId, estado: 'activo' });
    })
    .del();
}

function marcarAbandonado(cartId) {
  return db('carts').where({ id: cartId }).update({ estado: 'abandonado', recordatorio_enviado_at: db.fn.now(), updated_at: db.fn.now() });
}

// Usado por jobs/carritoAbandonado.job.js: carritos activos, con al menos
// un ítem, cuyo ítem agregado más reciente ya es más viejo que el umbral
// configurado (app_settings, ver appSetting.model.js) — es decir, nadie le
// tocó nada en ese tiempo, buena señal de que se "olvidó" el carrito.
function listCandidatosAAbandono(umbralFecha) {
  return db('carts as c')
    .join('cart_items as ci', 'ci.cart_id', 'c.id')
    .join('users as u', 'u.id', 'c.user_id')
    .where('c.estado', 'activo')
    .groupBy('c.id', 'u.id', 'u.email', 'u.nombre')
    .havingRaw('MAX(ci.agregado_at) < ?', [umbralFecha])
    .select('c.id as cart_id', 'u.id as user_id', 'u.email', 'u.nombre');
}

module.exports = {
  obtenerOCrearActivo,
  listItems,
  agregarItem,
  quitarItem,
  vaciar,
  marcarConvertido,
  quitarDeCarritoActivoSiExiste,
  marcarAbandonado,
  listCandidatosAAbandono,
};
