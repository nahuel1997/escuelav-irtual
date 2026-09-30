// =============================================================================
// panel.controller.js — Herramientas del panel de admin (portado de DBA24):
// menú configurable, habilitación de pantallas, Tester y manual por rol.
// =============================================================================
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const configService = require('../services/config.service');
const pantallas = require('../services/pantallas.service');
const loginLogModel = require('../models/loginLog.model');
const { emitirSesion } = require('./auth.controller');
const { generarPdf, enviarPdf } = require('../utils/pdfReporte');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// --- Menú del panel ---

const RUTA_ADMIN = /^\/admin-panel(\/[a-z0-9-]+)*$/;

const getMenu = asyncHandler(async (req, res) => {
  res.json({ menu: await configService.getJson('config.menu_admin', null) });
});

const guardarMenu = asyncHandler(async (req, res) => {
  const secciones = Array.isArray(req.body.secciones) ? req.body.secciones : null;
  if (!secciones) throw new AppError('Formato de menú inválido', 400);
  if (secciones.length > 20) throw new AppError('Máximo 20 secciones', 400);
  let total = 0;
  const limpio = secciones.map((s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    total += items.length;
    return {
      nombre: String(s.nombre || '').trim().slice(0, 40) || 'Sin nombre',
      items: items.map((it) => {
        const ruta = String(it.ruta || '');
        if (!RUTA_ADMIN.test(ruta)) throw new AppError(`Ruta inválida en el menú: ${ruta}`, 400);
        return { ruta, titulo: String(it.titulo || '').trim().slice(0, 50) || ruta, visible: it.visible !== false };
      }),
    };
  });
  if (total > 80) throw new AppError('Demasiados ítems en el menú', 400);
  await configService.set('config.menu_admin', { secciones: limpio });
  res.json({ menu: { secciones: limpio } });
});

const resetMenu = asyncHandler(async (req, res) => {
  await configService.set('config.menu_admin', '');
  res.json({ menu: null });
});

// --- Habilitación de pantallas ---

const getPantallas = asyncHandler(async (req, res) => {
  res.json({ pantallas: await pantallas.estados(), bloqueos: await pantallas.listBloqueos() });
});

const guardarPantallas = asyncHandler(async (req, res) => {
  res.json({ pantallas: await pantallas.guardarEstados(req.body || {}) });
});

const bloquearPantalla = asyncHandler(async (req, res) => {
  const { userId, pantalla, motivo } = req.body || {};
  await pantallas.bloquear({ userId: Number(userId), pantalla, motivo: String(motivo || '').trim().slice(0, 300), adminId: req.user.id });
  res.status(201).json({ bloqueos: await pantallas.listBloqueos() });
});

const desbloquearPantalla = asyncHandler(async (req, res) => {
  await pantallas.desbloquear(req.params.id);
  res.json({ bloqueos: await pantallas.listBloqueos() });
});

// Para el usuario logueado: sus propias pantallas bloqueadas.
const misBloqueos = asyncHandler(async (req, res) => {
  res.json({ bloqueos: await pantallas.bloqueosDe(req.user.id) });
});

// --- Tester: entrar como alumno o profesor de prueba ---
//
// Crea una cuenta de prueba (users.es_prueba) del rol elegido y le abre
// una sesión real; el panel guarda ese token como sesión del sitio y abre
// la app en otra pestaña. Al cerrar la sesión de prueba, la cuenta se
// desactiva y su sesión se revoca. Lo que haga la cuenta de prueba queda
// en la base marcado por pertenecer a una cuenta es_prueba.

const listTester = asyncHandler(async (req, res) => {
  const sesiones = await db('tester_sesiones as s')
    .leftJoin('users as u', 'u.id', 's.user_id')
    .leftJoin('users as a', 'a.id', 's.admin_id')
    .select('s.*', 'u.email as cuenta_email', 'a.nombre as admin_nombre')
    .orderBy('s.id', 'desc')
    .limit(50);
  const observaciones = await db('tester_observaciones as o')
    .leftJoin('users as a', 'a.id', 'o.admin_id')
    .select('o.*', 'a.nombre as admin_nombre')
    .orderBy('o.id', 'desc')
    .limit(300);
  res.json({ sesiones, observaciones });
});

const crearSesionTester = asyncHandler(async (req, res) => {
  const { rol } = req.body || {};
  if (!['alumno', 'profesor'].includes(rol)) throw new AppError('Elegí alumno o profesor', 400);
  const sufijo = crypto.randomBytes(4).toString('hex');
  const password_hash = await bcrypt.hash(crypto.randomBytes(24).toString('base64url'), 10);
  const [userId] = await db('users').insert({
    nombre: 'Prueba',
    apellido: rol === 'alumno' ? 'Alumno' : 'Profesor',
    email: `tester-${rol}-${sufijo}@prueba.invalid`,
    password_hash,
    rol,
    es_prueba: true,
    email_verificado: true,
  });
  const id = typeof userId === 'object' ? userId.id : userId;
  const user = await db('users').where({ id }).first();
  const [sesionId] = await db('tester_sesiones').insert({ admin_id: req.user.id, user_id: id, rol, nota: String((req.body || {}).nota || '').slice(0, 300) || null });
  const { token } = await emitirSesion(user, req);
  const { password_hash: _omitido, ...publico } = user;
  res.status(201).json({ sesionId: typeof sesionId === 'object' ? sesionId.id : sesionId, token, user: publico });
});

const cerrarSesionTester = asyncHandler(async (req, res) => {
  const s = await db('tester_sesiones').where({ id: req.params.id }).first();
  if (!s) throw new AppError('Sesión de prueba no encontrada', 404);
  if (!s.cerrada_en) {
    if (s.user_id) {
      await loginLogModel.revocarTodasDeUsuario(s.user_id);
      await db('users').where({ id: s.user_id, es_prueba: true }).update({ activo: false });
    }
    await db('tester_sesiones').where({ id: s.id }).update({ cerrada_en: db.fn.now() });
  }
  res.json({ ok: true });
});

const agregarObservacion = asyncHandler(async (req, res) => {
  const texto = String((req.body || {}).texto || '').trim();
  const tipo = ['bug', 'mejora', 'ok'].includes(req.body.tipo) ? req.body.tipo : 'bug';
  if (!texto) throw new AppError('Escribí la observación', 400);
  await db('tester_observaciones').insert({
    sesion_id: req.body.sesionId || null,
    admin_id: req.user.id,
    pantalla: String(req.body.pantalla || '').slice(0, 200) || null,
    tipo,
    texto: texto.slice(0, 5000),
  });
  res.status(201).json({ ok: true });
});

const borrarObservacion = asyncHandler(async (req, res) => {
  await db('tester_observaciones').where({ id: req.params.id }).del();
  res.json({ ok: true });
});

const observacionesPdf = asyncHandler(async (req, res) => {
  const obs = await db('tester_observaciones as o').leftJoin('users as a', 'a.id', 'o.admin_id')
    .select('o.*', 'a.nombre as admin_nombre').orderBy('o.id', 'asc');
  const TIPOS = { bug: 'Error', mejora: 'Mejora', ok: 'Funciona bien' };
  const buffer = await generarPdf({
    titulo: 'Observaciones de prueba',
    subtitulo: `${obs.length} observación${obs.length === 1 ? '' : 'es'}`,
    bloques: [{
      tipo: 'tabla',
      columnas: [{ titulo: 'Fecha', ancho: 1.3 }, { titulo: 'Tipo' }, { titulo: 'Pantalla', ancho: 1.5 }, { titulo: 'Observación', ancho: 4 }, { titulo: 'Por' }],
      filas: obs.map((o) => [new Date(o.created_at).toLocaleString('es-AR'), TIPOS[o.tipo] || o.tipo, o.pantalla, o.texto, o.admin_nombre]),
    }],
  });
  enviarPdf(res, buffer, 'observaciones-tester.pdf');
});

// --- Manual por rol ---

const ROLES_MANUAL = ['alumno', 'profesor', 'admin', 'soporte'];

const miManual = asyncHandler(async (req, res) => {
  res.json({ secciones: await db('manual_secciones').where({ rol: req.user.rol }).orderBy('orden').orderBy('id') });
});

const listManual = asyncHandler(async (req, res) => {
  res.json({ secciones: await db('manual_secciones').orderBy('rol').orderBy('orden').orderBy('id') });
});

function validarSeccion(b) {
  const rol = String(b.rol || '');
  const titulo = String(b.titulo || '').trim();
  const contenido = String(b.contenido || '').trim();
  if (!ROLES_MANUAL.includes(rol)) throw new AppError('Rol inválido', 400);
  if (!titulo || !contenido) throw new AppError('Completá el título y el contenido', 400);
  return { rol, titulo: titulo.slice(0, 200), contenido: contenido.slice(0, 20000), orden: Number.isInteger(Number(b.orden)) ? Number(b.orden) : 0 };
}

const crearSeccionManual = asyncHandler(async (req, res) => {
  await db('manual_secciones').insert(validarSeccion(req.body || {}));
  res.status(201).json({ ok: true });
});

const editarSeccionManual = asyncHandler(async (req, res) => {
  const n = await db('manual_secciones').where({ id: req.params.id }).update({ ...validarSeccion(req.body || {}), updated_at: db.fn.now() });
  if (!n) throw new AppError('Sección no encontrada', 404);
  res.json({ ok: true });
});

const borrarSeccionManual = asyncHandler(async (req, res) => {
  await db('manual_secciones').where({ id: req.params.id }).del();
  res.json({ ok: true });
});

module.exports = {
  getMenu,
  guardarMenu,
  resetMenu,
  getPantallas,
  guardarPantallas,
  bloquearPantalla,
  desbloquearPantalla,
  misBloqueos,
  listTester,
  crearSesionTester,
  cerrarSesionTester,
  agregarObservacion,
  borrarObservacion,
  observacionesPdf,
  miManual,
  listManual,
  crearSeccionManual,
  editarSeccionManual,
  borrarSeccionManual,
};
