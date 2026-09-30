const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userModel = require('../models/user.model');
const loginLogModel = require('../models/loginLog.model');
const loginIntentoModel = require('../models/loginIntento.model');
const loginEventoModel = require('../models/loginEvento.model');
const ipBloqueadaModel = require('../models/ipBloqueada.model');
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

function minutosHasta(fecha) {
  return Math.max(1, Math.ceil((fecha.getTime() - Date.now()) / 60000));
}

// Login con fuerza bruta escalonada (ver README "Seguridad de cuentas" y
// loginIntento.model.js). La clave de la racha es IP + email:
//   10 fallos -> espera 1 min · 20 fallos -> espera 5 min · 21 -> se
//   bloquea la IP (nunca la cuenta: si no, cualquiera podría dejar afuera a
//   un usuario sabiendo su email — misma decisión que DBA24).
// Una IP ya bloqueada ni llega acá: la corta ipBloqueada.middleware.js.
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new AppError('Ingresá tu email y tu contraseña', 400);
  }
  const emailNormalizado = String(email).toLowerCase().trim();
  const ip = req.ip;
  const userAgent = req.headers['user-agent'];
  const evento = (resultado, extra = {}) => loginEventoModel.registrar({ email: emailNormalizado, ip, userAgent, resultado, ...extra });

  // Por las dudas (ej: el middleware no está montado en algún entorno).
  if (await ipBloqueadaModel.estaBloqueada(ip)) {
    await evento('ip_bloqueada');
    throw new AppError('Tu conexión está bloqueada por seguridad.', 403);
  }

  // En espera: corta ANTES de bcrypt, sin revelar si la contraseña era buena.
  const clave = loginIntentoModel.armarClave(ip, emailNormalizado);
  const esperaHasta = await loginIntentoModel.estaEsperando(clave);
  if (esperaHasta) {
    await evento('espera');
    const minutos = minutosHasta(esperaHasta);
    throw new AppError(`Demasiados intentos fallidos. Esperá ${minutos} minuto${minutos === 1 ? '' : 's'} y volvé a intentar.`, 429);
  }

  const user = await userModel.findByEmail(emailNormalizado);
  // Corremos bcrypt.compare tanto si el usuario existe como si no (contra
  // un hash de relleno en ese caso) y respondemos con el mismo mensaje y
  // status en ambos casos — así no se pueden enumerar los emails
  // registrados probando logins uno por uno.
  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : HASH_RELLENO);
  if (!user || !passwordOk) {
    const { intentos, bloqueoDefinitivo } = await loginIntentoModel.registrarFallo(clave);
    if (bloqueoDefinitivo) {
      await ipBloqueadaModel.bloquear(ip, {
        motivo: `Bloqueo automático: ${intentos} intentos fallidos seguidos contra ${emailNormalizado}`,
      });
      await evento('bloqueo_ip', { userId: user?.id, detalle: `${intentos} fallos` });
    } else {
      await evento('fallido', { userId: user?.id, detalle: `${intentos} fallo${intentos === 1 ? '' : 's'} seguidos` });
    }
    // Mismo mensaje siempre: no delata ni el bloqueo recién hecho ni si la
    // cuenta existe.
    throw new AppError('Email o contraseña incorrectos', 401);
  }

  // Contraseña correcta: se limpia la racha. Recién acá (nunca en un
  // intento fallido) se revela si la cuenta está dada de baja o bloqueada.
  await loginIntentoModel.limpiar(clave);
  if (!user.activo) {
    await evento('inactivo', { userId: user.id });
    throw new AppError('Tu cuenta está desactivada. Si creés que es un error, contactá a la escuela.', 403);
  }
  if (user.bloqueado) {
    await evento('bloqueado', { userId: user.id });
    throw new AppError(`Tu cuenta está bloqueada. Motivo: ${user.bloqueado_motivo || 'sin especificar'}. Contactá a la escuela.`, 403);
  }

  const jti = crypto.randomUUID();
  const token = signToken(user, jti);
  await registrarSesion(user, req, jti);
  await evento('exitoso', { userId: user.id });
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

// Abre una sesión real (token + login_logs) para un usuario, sin
// contraseña — solo para usos internos del servidor (el Tester del panel
// de admin, ver panel.controller.js). Nunca se expone como endpoint.
async function emitirSesion(user, req) {
  const jti = crypto.randomUUID();
  const token = signToken(user, jti);
  await registrarSesion(user, req, jti);
  return { token, jti };
}

module.exports = { register, login, me, logout, verifyEmail, resendVerification, emitirSesion };
