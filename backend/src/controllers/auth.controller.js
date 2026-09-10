const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');
const loginLogModel = require('../models/loginLog.model');
const emailVerificationModel = require('../models/emailVerification.model');
const mailService = require('../services/mail.service');
const geoService = require('../services/geo.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// `jti` (JWT ID) identifica ESTE login puntual, no al usuario — dos
// logueos del mismo usuario (celular + compu) tienen jti distinto. Viaja
// adentro del token y también queda guardado en login_logs, así el
// middleware de auth puede confirmar en cada request que esa sesión
// puntual sigue activa (ver auth.middleware.js) y el admin puede cerrar
// una sin afectar las demás (ver admin.controller.js::revocarSesion).
function signToken(user, jti) {
  return jwt.sign(
    { id: user.id, email: user.email, rol: user.rol, nombre: user.nombre, jti },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

// Registra la sesión (login_logs) con de dónde se conectó, geolocalizando
// la IP en el mismo paso. Se llama desde register() y login() — ambos
// terminan logueando al usuario de entrada. Nunca tira: si algo falla acá
// (geolocalización caída, falta la migración, etc.) no tiene que romper
// el login, así que lo dejamos best-effort como el resto de los logs de
// esta app (ver mismo criterio en loginLogModel.create más abajo).
async function registrarSesion(user, req, jti) {
  const ip = req.ip;
  const { pais, provincia } = await geoService.resolverUbicacion(ip).catch(() => ({ pais: null, provincia: null }));
  await loginLogModel
    .create(user.id, { jti, ip, userAgent: req.headers['user-agent'], pais, provincia })
    .catch((e) => console.error('[login_logs]', e.message));
}

// Hash "de relleno" para comparar contra él cuando el email no existe, así
// bcrypt.compare corre siempre (ver login()) y el tiempo de respuesta no
// delata si la cuenta existe o no. El valor en sí no importa — nunca va a
// matchear ninguna contraseña real, solo sirve para gastar el mismo tiempo
// de cómputo que una comparación real.
const HASH_RELLENO = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8s6f3d/uEnFmA5PZ1jQ/Rrz.h9ND3O';

// Genera el código de 6 dígitos y manda el mail de validación. Se llama
// desde register() y desde resendVerification(). Best effort: si el mail
// no puede salir, no rompe el registro — el alumno igual queda logueado y
// puede pedir un reenvío después (ver mail.service.js, mismo criterio que
// loginLogModel.create más abajo).
async function mandarCodigoVerificacion(user) {
  const { codigo } = await emailVerificationModel.crear(user.id);
  await mailService.enviarMail({
    clave: 'verificacion_cuenta',
    destinatario: user.email,
    variables: { nombre: user.nombre, codigo },
    userId: user.id,
  });
}

const register = asyncHandler(async (req, res) => {
  const { nombre, apellido, email, password } = req.body;

  if (!nombre || !apellido || !email || !password) {
    throw new AppError('Completá tu nombre, apellido, email y contraseña para crear la cuenta', 400);
  }
  if (password.length < 6) {
    throw new AppError('La contraseña tiene que tener al menos 6 caracteres', 400);
  }
  // El registro público SIEMPRE crea una cuenta de alumno. Las cuentas de
  // profesor y admin se crean únicamente desde el panel de administración
  // (POST /api/admin/users, protegido por rol admin) — ignoramos a
  // propósito cualquier "rol" que venga en el body para que nadie pueda
  // auto-asignarse profesor/admin mandando el campo a mano.
  const rolFinal = 'alumno';

  const existente = await userModel.findByEmail(email.toLowerCase().trim());
  if (existente) {
    throw new AppError('Ya existe una cuenta con ese email. Probá iniciar sesión en vez de registrarte.', 409);
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await userModel.create({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: email.toLowerCase().trim(),
    password_hash,
    rol: rolFinal,
  });

  const jti = crypto.randomUUID();
  const token = signToken(user, jti);
  // El registro de logins es un "nice to have" para el admin, no algo que
  // tenga que poder bloquear que alguien se registre/loguee — si falla
  // (ej: falta correr una migración nueva), lo logueamos server-side y
  // seguimos. Ver mismo criterio en errorLog.model.
  await registrarSesion(user, req, jti);

  // La cuenta queda usable de entrada (registro = login inmediato, como ya
  // era antes). La validación por código de 6 dígitos es un paso aparte,
  // informativo/de confianza, que NO bloquea el acceso — ver
  // email_verificado en el modelo de usuario y VerifyEmail.jsx en el
  // frontend (banner opcional, no un gate).
  await mandarCodigoVerificacion(user).catch((e) => console.error('[mail verificacion]', e.message));

  res.status(201).json({ token, user });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Ingresá tu email y tu contraseña', 400);
  }

  const user = await userModel.findByEmail(email.toLowerCase().trim());
  // Corremos bcrypt.compare tanto si el usuario existe como si no (contra
  // un hash de relleno en ese caso) y respondemos con el mismo mensaje y
  // status en ambos casos. Antes distinguíamos "no existe cuenta" de
  // "contraseña incorrecta" para guiar mejor al usuario, pero eso permite
  // enumerar qué emails están registrados probando logins uno por uno —
  // en una plataforma que va a manejar altas de profesores/admins no vale
  // la pena ese costo por una UX apenas mejor.
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : HASH_RELLENO);
  if (!user || !passwordOk) {
    throw new AppError('Email o contraseña incorrectos', 401);
  }

  const jti = crypto.randomUUID();
  const token = signToken(user, jti);
  await registrarSesion(user, req, jti);
  const { password_hash, ...userPublico } = user;
  res.json({ token, user: userPublico });
});

const me = asyncHandler(async (req, res) => {
  const user = await userModel.findPublicById(req.user.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);
  res.json({ user });
});

// Marca en login_logs cuándo terminó esta conexión puntual (identificada
// por el jti del token), para que el historial de sesiones del admin
// muestre inicio y fin, y para que esta sesión no pueda seguir usándose
// (ver auth.middleware.js). El frontend llama a este endpoint antes de
// descartar el token (ver AuthContext.logout()).
const logout = asyncHandler(async (req, res) => {
  if (req.user.jti) {
    await loginLogModel.closeSession(req.user.jti).catch((e) => console.error('[login_logs]', e.message));
  } else {
    // Token viejo (emitido antes de que existiera jti) — fallback por
    // compatibilidad, ver comentario en loginLogModel.closeOpenSession.
    await loginLogModel.closeOpenSession(req.user.id).catch((e) => console.error('[login_logs]', e.message));
  }
  res.json({ ok: true });
});

// Valida el código de 6 dígitos que llegó por mail. Requiere estar
// logueado (usa req.user.id, no hace falta mandar el email de nuevo).
const verifyEmail = asyncHandler(async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) throw new AppError('Falta el código de verificación', 400);

  const user = await userModel.findById(req.user.id);
  if (user.email_verificado) {
    return res.json({ ok: true, yaEstabaVerificado: true });
  }

  const vigente = await emailVerificationModel.ultimoVigente(req.user.id);
  if (!vigente) {
    throw new AppError('No hay un código pendiente. Pedí que te reenvíen uno.', 400);
  }
  if (new Date(vigente.expira_en) < new Date()) {
    throw new AppError('El código venció. Pedí que te reenvíen uno nuevo.', 400);
  }
  if (vigente.intentos >= emailVerificationModel.INTENTOS_MAXIMOS) {
    throw new AppError('Superaste el máximo de intentos con este código. Pedí que te reenvíen uno nuevo.', 429);
  }
  if (vigente.codigo !== String(codigo).trim()) {
    await emailVerificationModel.incrementarIntentos(vigente.id);
    throw new AppError('Código incorrecto', 400);
  }

  await emailVerificationModel.marcarVerificado(vigente.id);
  await userModel.marcarEmailVerificado(req.user.id);

  await mailService.enviarMail({
    clave: 'bienvenida',
    destinatario: user.email,
    variables: { nombre: user.nombre },
    userId: user.id,
  });

  res.json({ ok: true });
});

// Pide un código nuevo (invalida al anterior en los hechos, ya que
// verifyEmail() siempre busca el más reciente). Rate limitado (ver
// rateLimit.middleware.js) para que no se pueda usar como spam de mails.
const resendVerification = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (user.email_verificado) {
    return res.json({ ok: true, yaEstabaVerificado: true });
  }
  await mandarCodigoVerificacion(user);
  res.json({ ok: true });
});

module.exports = { register, login, me, logout, verifyEmail, resendVerification };
