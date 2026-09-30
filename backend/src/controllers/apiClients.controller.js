// Gestión, desde el panel de admin, de los accesos a la API de datos
// (usuario/contraseña por sistema externo + qué tabla/columnas puede
// leer cada uno). Ver dataApi.controller.js para el endpoint que
// consumen esos accesos y dataCatalog.service.js para de dónde sale la
// lista de tablas/columnas disponibles.
const crypto = require('crypto');
const net = require('net');
const apiSeguridadModel = require('../models/apiSeguridad.model');
const bcrypt = require('bcryptjs');
const apiClientModel = require('../models/apiClient.model');
const apiUsageLogModel = require('../models/apiUsageLog.model');
const dataCatalogService = require('../services/dataCatalog.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Contraseña aleatoria de 24 caracteres (base64url: letras/números/-/_,
// sin ambigüedad de mayúscula/minúscula tipo "O"/"0" que sí tienen los
// generadores pensados para que un humano la tipee — acá la va a copiar y
// pegar un sistema, no un humano adivinándola de un cartel).
function generarPassword() {
  return crypto.randomBytes(18).toString('base64url');
}

const listClients = asyncHandler(async (req, res) => {
  const clients = await apiClientModel.listAll();
  res.json({ clients });
});

const getCatalogo = asyncHandler(async (req, res) => {
  const catalogo = await dataCatalogService.catalogoCompleto();
  res.json({ catalogo });
});

// Crea el acceso y devuelve la contraseña en texto plano UNA sola vez —
// después queda hasheada, no hay forma de volver a mostrarla (mismo
// criterio que un token de GitHub/Stripe): si se pierde, se regenera.
const createClient = asyncHandler(async (req, res) => {
  const { username, descripcion } = req.body;
  if (!username || !username.trim()) throw new AppError('Falta el nombre de usuario', 400);

  const usernameNormalizado = username.trim();
  const existente = await apiClientModel.findByUsername(usernameNormalizado);
  if (existente) throw new AppError('Ya existe un acceso con ese usuario', 409);

  const password = generarPassword();
  const password_hash = await bcrypt.hash(password, 10);
  const client = await apiClientModel.create({ username: usernameNormalizado, password_hash, descripcion });
  res.status(201).json({ client, password });
});

const regenerarPassword = asyncHandler(async (req, res) => {
  const client = await apiClientModel.findById(req.params.id);
  if (!client) throw new AppError('Acceso no encontrado', 404);

  const password = generarPassword();
  const password_hash = await bcrypt.hash(password, 10);
  await apiClientModel.setPassword(client.id, password_hash);
  res.json({ password });
});

const setActivo = asyncHandler(async (req, res) => {
  const { activo } = req.body;
  const client = await apiClientModel.findById(req.params.id);
  if (!client) throw new AppError('Acceso no encontrado', 404);
  await apiClientModel.setActivo(client.id, Boolean(activo));
  res.json({ client: await apiClientModel.findById(client.id) });
});

// Borra el acceso por completo (usuario/contraseña, permisos por tabla y
// su registro de uso) — a diferencia de "Desactivar" (setActivo), esto no
// se puede deshacer. Si un sistema externo todavía usaba estas
// credenciales, deja de poder autenticarse de inmediato (mismo efecto que
// desactivar, pero sin forma de reactivar después).
const deleteClient = asyncHandler(async (req, res) => {
  const client = await apiClientModel.findById(req.params.id);
  if (!client) throw new AppError('Acceso no encontrado', 404);
  await apiClientModel.remove(client.id);
  res.json({ ok: true });
});

// Da (o actualiza) acceso de un cliente a una tabla puntual, con la lista
// exacta de columnas permitidas. Volver a llamarlo con otra lista de
// columnas REEMPLAZA la anterior (no la suma) — es la forma de sacarle a
// alguien una columna que ya tenía.
const setPermiso = asyncHandler(async (req, res) => {
  const { id, tabla } = req.params;
  const { columnas } = req.body;
  if (!Array.isArray(columnas) || columnas.length === 0) {
    throw new AppError('Elegí al menos una columna', 400);
  }

  const client = await apiClientModel.findById(id);
  if (!client) throw new AppError('Acceso no encontrado', 404);

  // Solo se puede dar acceso a columnas que de verdad existen y no están
  // bloqueadas (ver dataCatalogService) — nunca lo que mande el body sin
  // filtrar, aunque venga del propio panel de admin.
  const columnasDisponibles = await dataCatalogService.listarColumnas(tabla);
  if (columnasDisponibles.length === 0) throw new AppError('Tabla inválida o sin columnas exponibles', 400);
  const columnasValidas = columnas.filter((c) => columnasDisponibles.includes(c));
  if (columnasValidas.length === 0) throw new AppError('Ninguna de las columnas elegidas es válida para esta tabla', 400);

  const permiso = await apiClientModel.setPermiso(client.id, tabla, columnasValidas);
  res.json({ permiso });
});

const quitarPermiso = asyncHandler(async (req, res) => {
  const { id, tabla } = req.params;
  await apiClientModel.quitarPermiso(id, tabla);
  res.json({ ok: true });
});

const listUso = asyncHandler(async (req, res) => {
  const client = await apiClientModel.findById(req.params.id);
  if (!client) throw new AppError('Acceso no encontrado', 404);
  const uso = await apiUsageLogModel.listByClient(client.id);
  res.json({ uso });
});

// --- Bloqueos de la API (IP o usuario de API) ---

const listBloqueados = asyncHandler(async (req, res) => {
  res.json({ bloqueados: await apiSeguridadModel.listBloqueados() });
});

const bloquear = asyncHandler(async (req, res) => {
  const { tipo } = req.body;
  const valor = String(req.body.valor || '').trim();
  const motivo = String(req.body.motivo || '').trim().slice(0, 500);
  if (!['ip', 'usuario'].includes(tipo)) throw new AppError('Tipo inválido (ip o usuario)', 400);
  if (!valor) throw new AppError(tipo === 'ip' ? 'Falta la IP' : 'Falta el usuario de API', 400);
  if (tipo === 'ip' && !net.isIP(valor)) throw new AppError('La IP no es válida', 400);
  if (!motivo) throw new AppError('Contá el motivo del bloqueo', 400);
  const bloqueo = await apiSeguridadModel.bloquear({ tipo, valor, motivo, bloqueadoPor: req.user.id });
  res.status(201).json({ bloqueo });
});

const desbloquear = asyncHandler(async (req, res) => {
  await apiSeguridadModel.desbloquear(req.params.id);
  res.json({ ok: true });
});

// --- Mensajes de error editables (el código y el status quedan fijos) ---

const listErrores = asyncHandler(async (req, res) => {
  res.json({ errores: await apiSeguridadModel.listErrores() });
});

const setError = asyncHandler(async (req, res) => {
  const mensaje = String(req.body.mensaje || '').trim();
  if (!mensaje) throw new AppError('El mensaje no puede quedar vacío', 400);
  if (mensaje.length > 500) throw new AppError('Máximo 500 caracteres', 400);
  const existente = await apiSeguridadModel.findError(req.params.codigo);
  if (!existente) throw new AppError('Código de error desconocido', 404);
  await apiSeguridadModel.setMensajeError(req.params.codigo, mensaje);
  res.json({ error: await apiSeguridadModel.findError(req.params.codigo) });
});

module.exports = {
  listBloqueados,
  bloquear,
  desbloquear,
  listErrores,
  setError,
  listClients,
  getCatalogo,
  createClient,
  regenerarPassword,
  setActivo,
  deleteClient,
  setPermiso,
  quitarPermiso,
  listUso,
};
