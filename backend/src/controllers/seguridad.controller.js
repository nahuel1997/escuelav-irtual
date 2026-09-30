// =============================================================================
// seguridad.controller.js — Seguridad de cuentas del panel de admin:
// alta/baja (activo), bloqueo manual de cuentas, IPs bloqueadas, historial
// de intentos de login y alertas a alumnos/profesores.
//
// Vive aparte de admin.controller.js (que ya era grande) — mismo prefijo
// /api/admin, ver admin.routes.js. Ver README "Seguridad de cuentas".
// =============================================================================
const net = require('net');
const userModel = require('../models/user.model');
const loginLogModel = require('../models/loginLog.model');
const loginEventoModel = require('../models/loginEvento.model');
const ipBloqueadaModel = require('../models/ipBloqueada.model');
const alertaModel = require('../models/alerta.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

function esUnoMismo(req) {
  return String(req.user.id) === String(req.params.id);
}

// --- Activo / inactivo (alta-baja, no borra nada) ---

const setActivo = asyncHandler(async (req, res) => {
  const { activo } = req.body;
  if (typeof activo !== 'boolean') throw new AppError('Falta "activo" (true/false)', 400);
  const user = await userModel.findById(req.params.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);
  if (!activo && esUnoMismo(req)) throw new AppError('No podés desactivar tu propia cuenta', 400);

  await userModel.setActivo(user.id, activo);
  // Una cuenta dada de baja no puede seguir usando una sesión ya abierta.
  if (!activo) await loginLogModel.revocarTodasDeUsuario(user.id).catch((e) => console.error('[login_logs]', e.message));
  res.json({ user: await userModel.findPublicById(user.id) });
});

// --- Bloqueo manual de cuenta ---

const setBloqueo = asyncHandler(async (req, res) => {
  const { bloqueado, motivo } = req.body;
  if (typeof bloqueado !== 'boolean') throw new AppError('Falta "bloqueado" (true/false)', 400);
  const user = await userModel.findById(req.params.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);
  if (bloqueado && esUnoMismo(req)) throw new AppError('No podés bloquear tu propia cuenta', 400);

  const motivoFinal = (motivo || '').trim().slice(0, 500) || 'Bloqueada por un administrador';
  await userModel.setBloqueo(user.id, { bloqueado, motivo: motivoFinal });
  if (bloqueado) await loginLogModel.revocarTodasDeUsuario(user.id).catch((e) => console.error('[login_logs]', e.message));
  res.json({ user: await userModel.findPublicById(user.id) });
});

// --- IPs bloqueadas ---

const listIps = asyncHandler(async (req, res) => {
  res.json({ ips: await ipBloqueadaModel.listAll() });
});

const bloquearIp = asyncHandler(async (req, res) => {
  const ip = String(req.body.ip || '').trim();
  const motivo = String(req.body.motivo || '').trim().slice(0, 500);
  if (!net.isIP(ip)) throw new AppError('La IP no es válida (ej: 203.0.113.9)', 400);
  if (!motivo) throw new AppError('Contá el motivo del bloqueo', 400);
  // Bloquear la propia IP te deja afuera del panel en el próximo click.
  if (ip === req.ip || `::ffff:${ip}` === req.ip) {
    throw new AppError('Esa es la IP desde la que estás conectado: te quedarías afuera del panel', 400);
  }
  const fila = await ipBloqueadaModel.bloquear(ip, { motivo, bloqueadoPor: req.user.id });
  const ips = await ipBloqueadaModel.listAll();
  res.status(201).json({ ip: ips.find((i) => i.id === fila.id) || fila });
});

const desbloquearIp = asyncHandler(async (req, res) => {
  const fila = await ipBloqueadaModel.findById(req.params.id);
  if (!fila) throw new AppError('IP no encontrada', 404);
  await ipBloqueadaModel.desbloquear(fila.id);
  res.json({ ok: true });
});

// --- Historial de intentos de login ---

const listLoginEventos = asyncHandler(async (req, res) => {
  const { resultado, q, desde, hasta, page } = req.query;
  const data = await loginEventoModel.listPage({ resultado, q, desde, hasta, page });
  res.json({ eventos: data.rows, total: data.total, page: data.page, totalPages: data.totalPages });
});

const resumenSeguridad = asyncHandler(async (req, res) => {
  const [intentos24h, ips] = await Promise.all([loginEventoModel.resumen24h(), ipBloqueadaModel.listAll()]);
  res.json({ intentos24h, ipsBloqueadas: ips.length });
});

// --- Alertas (alta + historial del admin) ---

const listAlertas = asyncHandler(async (req, res) => {
  res.json({ alertas: await alertaModel.listAll() });
});

const crearAlerta = asyncHandler(async (req, res) => {
  const { userIds, mensaje } = req.body;
  const texto = String(mensaje || '').trim();
  if (!Array.isArray(userIds) || userIds.length === 0) throw new AppError('Elegí al menos un destinatario', 400);
  if (!texto) throw new AppError('Escribí el mensaje de la alerta', 400);
  if (texto.length > 2000) throw new AppError('El mensaje es demasiado largo (máximo 2000 caracteres)', 400);

  const ids = [...new Set(userIds.map(Number).filter(Number.isInteger))];
  const usuarios = await userModel.findPublicByIds(ids);
  if (usuarios.length !== ids.length) throw new AppError('Algún destinatario no existe', 400);
  if (usuarios.some((u) => !['alumno', 'profesor'].includes(u.rol))) {
    throw new AppError('Las alertas solo se pueden mandar a alumnos o profesores', 400);
  }

  await alertaModel.crear({ userIds: ids, adminId: req.user.id, mensaje: texto });
  res.status(201).json({ ok: true, enviadas: ids.length });
});

module.exports = {
  setActivo,
  setBloqueo,
  listIps,
  bloquearIp,
  desbloquearIp,
  listLoginEventos,
  resumenSeguridad,
  listAlertas,
  crearAlerta,
};
