// Autenticación de la API de datos para sistemas externos (ver
// dataApi.controller.js) — HTTP Basic Auth (usuario/contraseña) contra
// api_clients, NO el JWT de la app (los alumnos/profesores/admin no
// tienen por qué poder pegarle a esta API con su propia sesión, y
// viceversa: un cliente de esta API no es una cuenta de usuario).
const bcrypt = require('bcryptjs');
const apiClientModel = require('../models/apiClient.model');
const { AppError } = require('./error.middleware');

// Mismo truco de "hash de relleno" que auth.controller.js::login — corre
// bcrypt.compare siempre, exista o no el username, para no filtrar por
// tiempo de respuesta qué usuarios de API existen.
const HASH_RELLENO = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8s6f3d/uEnFmA5PZ1jQ/Rrz.h9ND3O';

async function apiClientAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, credenciales] = header.split(' ');

  if (scheme !== 'Basic' || !credenciales) {
    res.set('WWW-Authenticate', 'Basic realm="API de datos"');
    return next(new AppError('Falta autenticación (usuario y contraseña de la API)', 401));
  }

  let username;
  let password;
  try {
    [username, password] = Buffer.from(credenciales, 'base64').toString('utf8').split(':');
  } catch (_e) {
    return next(new AppError('Credenciales mal formadas', 401));
  }

  const cliente = await apiClientModel.findByUsername(username || '');
  const passwordOk = await bcrypt.compare(password || '', cliente ? cliente.password_hash : HASH_RELLENO);
  if (!cliente || !passwordOk) {
    return next(new AppError('Usuario o contraseña incorrectos', 401));
  }
  if (!cliente.activo) {
    return next(new AppError('Este acceso fue desactivado', 403));
  }

  req.apiClient = { id: cliente.id, username: cliente.username };
  next();
}

module.exports = { apiClientAuth };
