// =============================================================================
// tickets.controller.js — Tickets de soporte (portado de DBA24).
//
// Tres puntas:
// - Usuario (alumno/profesor): abre tickets, responde, adjunta, cierra.
// - Gestión (admin y agentes de soporte): bandeja, tablero, estado,
//   prioridad, asignación, etiquetas, notas internas, pedido de aprobación.
// - Aprobación por link (pública, sin login): el token del mail es la única
//   credencial; en la base solo queda su hash.
// =============================================================================
const crypto = require('crypto');
const fs = require('fs');
const env = require('../config/env');
const ticketModel = require('../models/ticket.model');
const userModel = require('../models/user.model');
const storageService = require('../services/storage.service');
const mailService = require('../services/mail.service');
const { escaparHtml } = require('../utils/template');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const ROLES_GESTION = ['admin', 'soporte'];
const ESTADO_LABEL = {
  abierto: 'Abierto',
  en_curso: 'En curso',
  esperando_usuario: 'Esperando tu respuesta',
  resuelto: 'Resuelto',
  cerrado: 'Cerrado',
};

function esGestion(user) {
  return ROLES_GESTION.includes(user.rol);
}

function adjuntosDe(files) {
  return (files || []).map((f) => ({
    archivo: f.filename,
    nombre_original: String(f.originalname || '').slice(0, 200),
    mime: f.mimetype,
    tamano: f.size,
  }));
}

function borrarSubidos(files) {
  (files || []).forEach((f) => fs.unlink(f.path, () => {}));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function avisarUsuario(ticket, mensaje) {
  return userModel.findById(ticket.user_id).then((dueno) => {
    if (!dueno) return null;
    return mailService.enviarMail({
      clave: 'ticket_respuesta',
      destinatario: dueno.email,
      userId: dueno.id,
      variables: {
        nombre: escaparHtml(dueno.nombre),
        numero: ticketModel.numero(ticket.id),
        asunto_ticket: escaparHtml(ticket.asunto),
        mensaje: escaparHtml(mensaje),
        estado: ESTADO_LABEL[ticket.estado] || ticket.estado,
        link: `${env.FRONTEND_URL}/mis-consultas/${ticket.id}`,
      },
    });
  }).catch((e) => console.error('[tickets] aviso al usuario', e.message));
}

// --- Usuario ---

const crear = asyncHandler(async (req, res) => {
  const asunto = String(req.body.asunto || '').trim();
  const mensaje = String(req.body.mensaje || '').trim();
  const categoria = String(req.body.categoria || '').trim().slice(0, 60) || null;
  if (!asunto || !mensaje) {
    borrarSubidos(req.files);
    throw new AppError('Completá el asunto y contanos qué necesitás', 400);
  }
  if (asunto.length > 200 || mensaje.length > 10000) {
    borrarSubidos(req.files);
    throw new AppError('El texto es demasiado largo', 400);
  }
  const id = await ticketModel.crear({
    userId: req.user.id,
    asunto,
    categoria,
    mensaje,
    autorRol: req.user.rol,
    adjuntos: adjuntosDe(req.files),
  });

  if (env.SOPORTE_AVISO_MAIL) {
    mailService.enviarMail({
      clave: 'ticket_nuevo_admin',
      destinatario: env.SOPORTE_AVISO_MAIL,
      variables: { nombre: escaparHtml(req.user.nombre || req.user.email), numero: ticketModel.numero(id), asunto_ticket: escaparHtml(asunto), mensaje: escaparHtml(mensaje) },
    }).catch(() => {});
  }
  res.status(201).json({ ticket: await ticketModel.findById(id) });
});

const mios = asyncHandler(async (req, res) => {
  res.json({ tickets: await ticketModel.listar({ userId: req.user.id }) });
});

async function ticketVisible(req, id) {
  const gestion = esGestion(req.user);
  const ticket = await ticketModel.detalle(id, { incluirInternos: gestion });
  if (!ticket || (!gestion && ticket.user_id !== req.user.id)) throw new AppError('Ticket no encontrado', 404);
  return ticket;
}

const detalle = asyncHandler(async (req, res) => {
  res.json({ ticket: await ticketVisible(req, req.params.id) });
});

const responder = asyncHandler(async (req, res) => {
  const ticket = await ticketVisible(req, req.params.id).catch((e) => { borrarSubidos(req.files); throw e; });
  const mensaje = String(req.body.mensaje || '').trim();
  if (!mensaje) {
    borrarSubidos(req.files);
    throw new AppError('Escribí un mensaje', 400);
  }
  if (ticket.estado === 'cerrado') {
    borrarSubidos(req.files);
    throw new AppError('El ticket está cerrado. Si necesitás algo más, abrí uno nuevo.', 409);
  }
  const gestion = esGestion(req.user);
  const interno = gestion && (req.body.interno === true || req.body.interno === 'true');
  await ticketModel.agregarMensaje({
    ticketId: ticket.id,
    userId: req.user.id,
    autorRol: req.user.rol,
    mensaje: mensaje.slice(0, 10000),
    interno,
    adjuntos: adjuntosDe(req.files),
  });

  if (!gestion) {
    // El usuario contestó: si estaba esperándolo, vuelve a la cola del equipo.
    if (['esperando_usuario', 'resuelto'].includes(ticket.estado)) await ticketModel.actualizar(ticket.id, { estado: 'abierto' });
  } else if (!interno) {
    const nuevoEstado = ticket.estado === 'abierto' ? 'esperando_usuario' : ticket.estado;
    if (nuevoEstado !== ticket.estado) await ticketModel.actualizar(ticket.id, { estado: nuevoEstado });
    avisarUsuario({ ...ticket, estado: nuevoEstado }, mensaje);
  }
  res.status(201).json({ ticket: await ticketModel.detalle(ticket.id, { incluirInternos: gestion }) });
});

// El dueño puede cerrar su propio ticket (ya se resolvió por su cuenta).
const cerrarPropio = asyncHandler(async (req, res) => {
  const ticket = await ticketVisible(req, req.params.id);
  if (ticket.user_id !== req.user.id) throw new AppError('Ticket no encontrado', 404);
  await ticketModel.actualizar(ticket.id, { estado: 'cerrado', cerrado_en: new Date() });
  await ticketModel.agregarMensaje({ ticketId: ticket.id, userId: req.user.id, autorRol: req.user.rol, mensaje: 'Cerró la consulta.', sistema: true });
  res.json({ ok: true });
});

// Adjuntos: el dueño (salvo los de notas internas) o el equipo.
const adjunto = asyncHandler(async (req, res) => {
  const a = await ticketModel.findAdjunto(req.params.adjuntoId);
  const gestion = esGestion(req.user);
  if (!a || (!gestion && (a.user_id !== req.user.id || a.interno))) throw new AppError('Archivo no encontrado', 404);
  const ruta = storageService.rutaPrivada('tickets', a.archivo);
  if (!fs.existsSync(ruta)) throw new AppError('El archivo ya no está en el servidor', 404);
  res.type(a.mime || 'application/octet-stream');
  const disposicion = /^image\/|^application\/pdf$/.test(a.mime || '') ? 'inline' : 'attachment';
  res.set('Content-Disposition', `${disposicion}; filename="${encodeURIComponent(a.nombre_original || a.archivo)}"`);
  res.set('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(ruta).pipe(res);
});

// --- Gestión (admin / soporte) ---

const listarGestion = asyncHandler(async (req, res) => {
  const { estado, asignado, etiqueta, q, prioridad } = req.query;
  const asignadoA = asignado === 'yo' ? req.user.id : asignado;
  res.json({ tickets: await ticketModel.listar({ estado, asignadoA, etiquetaId: etiqueta, q, prioridad }) });
});

const tablero = asyncHandler(async (req, res) => {
  res.json(await ticketModel.tablero());
});

const agentes = asyncHandler(async (req, res) => {
  const [admins, soporte] = await Promise.all([userModel.listByRole('admin'), userModel.listByRole('soporte')]);
  res.json({ agentes: [...admins, ...soporte].filter((u) => u.activo !== false) });
});

const actualizar = asyncHandler(async (req, res) => {
  const ticket = await ticketModel.findById(req.params.id);
  if (!ticket) throw new AppError('Ticket no encontrado', 404);
  const { estado, prioridad, asignado_a: asignadoA, etiquetas } = req.body;
  const patch = {};
  const cambios = [];

  if (estado !== undefined && estado !== ticket.estado) {
    if (!ticketModel.ESTADOS.includes(estado)) throw new AppError('Estado inválido', 400);
    patch.estado = estado;
    patch.cerrado_en = estado === 'cerrado' ? new Date() : null;
    cambios.push(`Estado: ${ESTADO_LABEL[estado]}`);
  }
  if (prioridad !== undefined && prioridad !== ticket.prioridad) {
    if (!ticketModel.PRIORIDADES.includes(prioridad)) throw new AppError('Prioridad inválida', 400);
    patch.prioridad = prioridad;
    cambios.push(`Prioridad: ${prioridad}`);
  }
  if (asignadoA !== undefined && String(asignadoA || '') !== String(ticket.asignado_a || '')) {
    if (asignadoA) {
      const agente = await userModel.findById(asignadoA);
      if (!agente || !ROLES_GESTION.includes(agente.rol)) throw new AppError('Solo se puede asignar a un admin o agente de soporte', 400);
      patch.asignado_a = agente.id;
      cambios.push(`Asignado a ${agente.nombre} ${agente.apellido}`);
    } else {
      patch.asignado_a = null;
      cambios.push('Sin asignar');
    }
  }
  if (Object.keys(patch).length) await ticketModel.actualizar(ticket.id, patch);
  if (Array.isArray(etiquetas)) {
    const validas = (await ticketModel.listEtiquetas()).map((e) => e.id);
    await ticketModel.setEtiquetas(ticket.id, [...new Set(etiquetas.map(Number))].filter((id) => validas.includes(id)));
  }
  if (cambios.length) {
    await ticketModel.agregarMensaje({ ticketId: ticket.id, userId: req.user.id, autorRol: req.user.rol, mensaje: cambios.join(' · '), sistema: true });
    if (patch.estado && ['resuelto', 'cerrado'].includes(patch.estado)) {
      avisarUsuario({ ...ticket, ...patch }, `Tu consulta pasó a "${ESTADO_LABEL[patch.estado]}".`);
    }
  }
  res.json({ ticket: await ticketModel.detalle(ticket.id, { incluirInternos: true }) });
});

// Etiquetas (las maneja el equipo).
const listEtiquetas = asyncHandler(async (req, res) => {
  res.json({ etiquetas: await ticketModel.listEtiquetas() });
});

function validarEtiqueta(body) {
  const nombre = String(body.nombre || '').trim().slice(0, 40);
  const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : '#1c3d5a';
  if (!nombre) throw new AppError('Falta el nombre de la etiqueta', 400);
  return { nombre, color };
}

const crearEtiqueta = asyncHandler(async (req, res) => {
  const datos = validarEtiqueta(req.body);
  const existente = (await ticketModel.listEtiquetas()).find((e) => e.nombre.toLowerCase() === datos.nombre.toLowerCase());
  if (existente) throw new AppError('Ya existe una etiqueta con ese nombre', 409);
  res.status(201).json({ etiqueta: await ticketModel.crearEtiqueta(datos) });
});

const editarEtiqueta = asyncHandler(async (req, res) => {
  await ticketModel.actualizarEtiqueta(req.params.id, validarEtiqueta(req.body));
  res.json({ ok: true });
});

const borrarEtiqueta = asyncHandler(async (req, res) => {
  await ticketModel.borrarEtiqueta(req.params.id);
  res.json({ ok: true });
});

// Pedido de aprobación: se manda por mail un link de un solo uso.
const DIAS_VIGENCIA_APROBACION = 7;

const pedirAprobacion = asyncHandler(async (req, res) => {
  const ticket = await ticketModel.findById(req.params.id);
  if (!ticket) throw new AppError('Ticket no encontrado', 404);
  const detalleTexto = String(req.body.detalle || '').trim();
  if (!detalleTexto) throw new AppError('Contá qué tiene que aprobar', 400);
  if (detalleTexto.length > 3000) throw new AppError('El detalle es demasiado largo', 400);

  const token = crypto.randomBytes(32).toString('base64url');
  const expiraEn = new Date(Date.now() + DIAS_VIGENCIA_APROBACION * 86400000);
  await ticketModel.crearAprobacion({ ticketId: ticket.id, tokenHash: hashToken(token), detalle: detalleTexto, creadoPor: req.user.id, expiraEn });
  await ticketModel.actualizar(ticket.id, { estado: 'esperando_usuario' });
  await ticketModel.agregarMensaje({ ticketId: ticket.id, userId: req.user.id, autorRol: req.user.rol, mensaje: `Se pidió aprobación: ${detalleTexto}`, sistema: true });

  const dueno = await userModel.findById(ticket.user_id);
  const link = `${env.FRONTEND_URL}/aprobacion/${token}`;
  const envio = await mailService.enviarMail({
    clave: 'ticket_aprobacion',
    destinatario: dueno.email,
    userId: dueno.id,
    variables: {
      nombre: escaparHtml(dueno.nombre),
      numero: ticketModel.numero(ticket.id),
      asunto_ticket: escaparHtml(ticket.asunto),
      detalle: escaparHtml(detalleTexto),
      link,
      vence: expiraEn.toLocaleDateString('es-AR'),
    },
  });
  // En test se devuelve el token para poder probar la página pública.
  res.status(201).json({ ok: true, mailEnviado: Boolean(envio && envio.ok), ...(env.NODE_ENV === 'test' ? { token } : {}) });
});

// --- Aprobación pública (sin login) ---

async function aprobacionVigente(token) {
  const ap = await ticketModel.findAprobacionPorHash(hashToken(token));
  if (!ap) throw new AppError('El link no es válido', 404);
  return ap;
}

const verAprobacion = asyncHandler(async (req, res) => {
  const ap = await aprobacionVigente(req.params.token);
  res.json({
    aprobacion: {
      numero: ticketModel.numero(ap.ticket_id),
      asunto: ap.asunto,
      nombre: ap.nombre,
      detalle: ap.detalle,
      estado: ap.estado,
      vencida: ap.estado === 'pendiente' && new Date(ap.expira_en) < new Date(),
      respondido_en: ap.respondido_en,
    },
  });
});

const responderAprobacion = asyncHandler(async (req, res) => {
  const ap = await aprobacionVigente(req.params.token);
  const { decision } = req.body;
  const comentario = String(req.body.comentario || '').trim().slice(0, 2000);
  if (!['aprobado', 'rechazado'].includes(decision)) throw new AppError('Elegí aprobar o rechazar', 400);
  if (ap.estado !== 'pendiente') throw new AppError('Este pedido ya fue respondido', 409);
  if (new Date(ap.expira_en) < new Date()) throw new AppError('El link venció. Pedí uno nuevo desde tu consulta.', 410);

  const cambiadas = await ticketModel.responderAprobacion(ap.id, { estado: decision, comentario });
  if (!cambiadas) throw new AppError('Este pedido ya fue respondido', 409);
  await ticketModel.agregarMensaje({
    ticketId: ap.ticket_id,
    userId: ap.user_id,
    autorRol: 'aprobacion',
    mensaje: `${decision === 'aprobado' ? 'Aprobó' : 'Rechazó'} el pedido${comentario ? `: ${comentario}` : '.'}`,
    sistema: true,
  });
  await ticketModel.actualizar(ap.ticket_id, { estado: 'en_curso' });
  res.json({ ok: true, estado: decision });
});

module.exports = {
  ROLES_GESTION,
  crear,
  mios,
  detalle,
  responder,
  cerrarPropio,
  adjunto,
  listarGestion,
  tablero,
  agentes,
  actualizar,
  listEtiquetas,
  crearEtiqueta,
  editarEtiqueta,
  borrarEtiqueta,
  pedirAprobacion,
  verAprobacion,
  responderAprobacion,
};
