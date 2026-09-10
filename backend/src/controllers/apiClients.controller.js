// Gestión, desde el panel de admin, de los accesos a la API de datos
// (usuario/contraseña por sistema externo + qué tabla/columnas puede
// leer cada uno). Ver dataApi.controller.js para el endpoint que
// consumen esos accesos y dataCatalog.service.js para de dónde sale la
// lista de tablas/columnas disponibles.
const crypto = require('crypto');
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

module.exports = {
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
