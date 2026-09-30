// Autenticación de la API de datos para sistemas externos (ver
// dataApi.controller.js) — HTTP Basic Auth (usuario/contraseña) contra
// api_clients, NO el JWT de la app (los alumnos/profesores/admin no
// tienen por qué poder pegarle a esta API con su propia sesión, y
// viceversa: un cliente de esta API no es una cuenta de usuario).
//
// Además (mismo perímetro que la API de DBA24): IPs y usuarios de API
// bloqueados, fuerza bruta escalonada por IP + usuario, y textos de error
// editables desde el panel (ver apiSeguridad.model.js).
const bcrypt = require('bcryptjs');
const apiClientModel = require('../models/apiClient.model');
const apiSeguridadModel = require('../models/apiSeguridad.model');
const { errorApi, formatoEspera } = require('../services/apiErrores.service');

// Mismo truco de "hash de relleno" que auth.controller.js::login — corre
// bcrypt.compare siempre, exista o no el username, para no filtrar por
// tiempo de respuesta qué usuarios de API existen.
const HASH_RELLENO = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8s6f3d/uEnFmA5PZ1jQ/Rrz.h9ND3O';

async function apiClientAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, credenciales] = header.split(' ');

    if (scheme !== 'Basic' || !credenciales) {
      res.set('WWW-Authenticate', 'Basic realm="API de datos"');
      return next(await errorApi('SIN_AUTENTICACION', { status: 401, porDefecto: 'Falta autenticación (usuario y contraseña de la API)' }));
    }

    let username;
    let password;
    try {
      [username, password] = Buffer.from(credenciales, 'base64').toString('utf8').split(':');
    } catch (_e) {
      return next(await errorApi('CREDENCIALES_MAL_FORMADAS', { status: 401, porDefecto: 'Credenciales mal formadas' }));
    }

    const ip = req.ip;
    if (await apiSeguridadModel.estaBloqueado({ ip, username })) {
      return next(await errorApi('BLOQUEADO', { status: 403, porDefecto: 'Acceso bloqueado' }));
    }

    const esperaMs = await apiSeguridadModel.esperaRestanteMs(ip, username);
    if (esperaMs > 0) {
      return next(await errorApi('DEMASIADOS_INTENTOS', { status: 429, porDefecto: 'Demasiados intentos. Esperá {espera}.', variables: { espera: formatoEspera(esperaMs) } }));
    }

    const cliente = await apiClientModel.findByUsername(username || '');
    const passwordOk = await bcrypt.compare(password || '', cliente ? cliente.password_hash : HASH_RELLENO);
    if (!cliente || !passwordOk) {
      const r = await apiSeguridadModel.registrarFallo(ip, username);
      if (r?.esperaMs) {
        return next(await errorApi('DEMASIADOS_INTENTOS', { status: 429, porDefecto: 'Demasiados intentos. Esperá {espera}.', variables: { espera: formatoEspera(r.esperaMs) } }));
      }
      return next(await errorApi('CREDENCIALES_INVALIDAS', { status: 401, porDefecto: 'Usuario o contraseña incorrectos' }));
    }
    if (!cliente.activo) {
      return next(await errorApi('ACCESO_DESACTIVADO', { status: 403, porDefecto: 'Este acceso fue desactivado' }));
    }

    await apiSeguridadModel.registrarExito(ip, username);
    req.apiClient = { id: cliente.id, username: cliente.username };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { apiClientAuth };
