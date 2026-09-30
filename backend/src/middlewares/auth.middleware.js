// Middlewares de autenticación y autorización basados en JWT.
//
// requireAuth: exige un Authorization: Bearer <token> válido y cuelga el
//   payload decodificado en req.user. Además, si el token tiene `jti`
//   (todos los emitidos desde que existe el historial de sesiones — ver
//   auth.controller.js::signToken), confirma contra login_logs que esa
//   sesión puntual sigue activa. Esto es lo que hace posible que un admin
//   fuerce el cierre de una sesión ajena (ver admin.controller.js) y que
//   dejé de servir en el momento, sin esperar a que el JWT expire solo —
//   jwt.verify() por sí solo no tiene forma de saber eso, es sin estado.
// requireRole('profesor'): además de estar logueado, exige un rol
//   específico (o una lista de roles válidos).
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const loginLogModel = require('../models/loginLog.model');
const { AppError } = require('./error.middleware');
const presencia = require('../services/presencia.service');
const mantenimiento = require('../services/mantenimiento.service');
const pantallas = require('../services/pantallas.service');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('No autenticado: falta el token de sesión', 401));
  }

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Sesión inválida o expirada, volvé a iniciar sesión', 401));
  }

  // Tokens emitidos antes de esta funcionalidad no tienen jti: los
  // dejamos pasar sin chequear login_logs (no se pueden revocar, pero
  // expiran solos dentro de JWT_EXPIRES_IN — es una ventana de
  // transición, no un agujero permanente).
  if (payload.jti) {
    try {
      const activa = await loginLogModel.estaActiva(payload.jti);
      if (!activa) {
        return next(new AppError('Tu sesión fue cerrada. Volvé a iniciar sesión.', 401));
      }
    } catch (err) {
      // Si falla la consulta (ej: falta correr la migración todavía) no
      // tiene sentido tirar abajo TODA la app dejando a nadie loguearse
      // — se loguea el error y se deja pasar, igual que el resto de los
      // "best effort" de esta capa (ver loginLogModel.create).
      console.error('[auth] no se pudo validar la sesión contra login_logs', err.message);
    }
  }

  req.user = payload; // { id, email, rol, jti }
  presencia.marcar(payload, req.originalUrl);

  // Modo mantenimiento por rol (Admin → Configuración): el rol afectado
  // recibe 503 en todo menos /api/auth/* (para poder ver su sesión y salir).
  if (req.baseUrl !== '/api/auth') {
    try {
      const mant = await mantenimiento.bloqueaA(payload.rol);
      if (mant) {
        const err = new AppError(mant.mensaje, 503);
        err.codigo = 'MANTENIMIENTO';
        return next(err);
      }
      // Habilitación de pantallas: sección en reparación u oculta, o
      // bloqueada para este usuario puntual (ver pantallas.service.js).
      const restriccion = await pantallas.restriccion(payload, req.baseUrl);
      if (restriccion) {
        const err = new AppError(restriccion.mensaje, restriccion.status);
        err.codigo = restriccion.codigo;
        return next(err);
      }
    } catch (err) {
      console.error('[auth] no se pudo leer el modo mantenimiento', err.message);
    }
  }
  next();
}

function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError('No autenticado', 401));
    if (!rolesPermitidos.includes(req.user.rol)) {
      return next(new AppError('No tenés permisos para realizar esta acción', 403));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
