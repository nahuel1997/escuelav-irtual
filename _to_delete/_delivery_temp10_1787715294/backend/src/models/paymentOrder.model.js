// Capa de acceso a payment_orders — ver la migración
// 20260827000004_create_payment_orders.js para el porqué de esta tabla.
const db = require('../config/db');

function create({ userId, provider, items, total, moneda, esPrueba }) {
  return db('payment_orders').insert({
    user_id: userId,
    provider,
    items: JSON.stringify(items),
    total,
    moneda,
    status: 'pendiente',
    es_prueba: !!esPrueba,
  });
}

async function findById(id) {
  const row = await db('payment_orders').where({ id }).first();
  return row ? { ...row, items: JSON.parse(row.items) } : null;
}

async function findByExternalId(provider, externalId) {
  const row = await db('payment_orders').where({ provider, external_id: externalId }).first();
  return row ? { ...row, items: JSON.parse(row.items) } : null;
}

function setExternalId(id, externalId) {
  return db('payment_orders').where({ id }).update({ external_id: externalId, updated_at: db.fn.now() });
}

// Idempotente a propósito: si dos disparos (el webhook y el retorno del
// alumno a la app) llegan casi al mismo tiempo, el primero que pise
// 'aprobado' gana — el que llega después ve el estado ya definitivo y no
// vuelve a inscribir ni a mandar el mail de confirmación de nuevo (eso lo
// resuelve el controller, ver finalizarOrdenSiAprobada en
// payments.controller.js, chequeando el status actual antes de actuar).
function marcarEstado(id, { status, paymentId }) {
  const patch = { status, updated_at: db.fn.now() };
  if (paymentId) patch.payment_id = paymentId;
  if (status === 'aprobado') patch.paid_at = db.fn.now();
  return db('payment_orders').where({ id }).update(patch);
}

function listForUser(userId) {
  return db('payment_orders').where({ user_id: userId }).orderBy('created_at', 'desc');
}

// Para /admin-panel/testing/pagos: historial de órdenes de prueba que el
// propio admin fue generando con la herramienta "Test Pagos" — nunca
// mezcla con compras reales de otros usuarios (filtra por su user_id
// además de es_prueba).
async function listPruebasForUser(userId) {
  const rows = await db('payment_orders')
    .where({ user_id: userId, es_prueba: true })
    .orderBy('created_at', 'desc')
    .limit(50);
  return rows.map((r) => ({ ...r, items: JSON.parse(r.items) }));
}

// Para el panel de admin (solo lectura) — ver "Pagos" en README.
async function listAll({ estado, page = 1 } = {}) {
  const PAGE_SIZE = 20;
  const paginaValida = Math.max(1, Number(page) || 1);
  const query = db('payment_orders as po')
    .join('users as u', 'u.id', 'po.user_id')
    .select('po.*', 'u.nombre', 'u.apellido', 'u.email');
  if (estado) query.where('po.status', estado);
  const [rows, totalRow] = await Promise.all([
    query.clone().orderBy('po.created_at', 'desc').limit(PAGE_SIZE).offset((paginaValida - 1) * PAGE_SIZE),
    db('payment_orders').modify((qb) => { if (estado) qb.where('status', estado); }).count({ count: '*' }).first(),
  ]);
  return { rows: rows.map((r) => ({ ...r, items: JSON.parse(r.items) })), total: Number(totalRow.count) };
}

module.exports = { create, findById, findByExternalId, setExternalId, marcarEstado, listForUser, listPruebasForUser, listAll };
