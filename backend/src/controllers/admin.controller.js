const bcrypt = require('bcryptjs');
const adminModel = require('../models/admin.model');
const userModel = require('../models/user.model');
const courseModel = require('../models/course.model');
const contentModel = require('../models/content.model');
const calendarModel = require('../models/calendarEvent.model');
const navLinkModel = require('../models/navLink.model');
const buttonOptionModel = require('../models/buttonOption.model');
const errorLogModel = require('../models/errorLog.model');
const loginLogModel = require('../models/loginLog.model');
const chatConversationModel = require('../models/chatConversation.model');
const chatMessageModel = require('../models/chatMessage.model');
const storageService = require('../services/storage.service');
const { esRolValido } = require('../utils/roles');
const { esTipoValido } = require('../utils/contentTipos');
const ESTADOS_CURSO = require('../config/estadosCurso');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await adminModel.dashboard();
  res.json(data);
});

// --- Usuarios (crear profesores/admins/soporte — no hay registro público para esto) ---

const listUsersByRole = asyncHandler(async (req, res) => {
  // "todos" es un caso especial para el filtro de usuario del registro de
  // logins, que necesita elegir entre cualquier cuenta sin importar el rol.
  if (req.query.rol === 'todos') {
    const users = await userModel.listAll();
    return res.json({ users });
  }
  const rol = req.query.rol || 'profesor';
  if (!esRolValido(rol)) throw new AppError('Rol inválido', 400);
  const users = await userModel.listByRole(rol);
  res.json({ users });
});

const createUser = asyncHandler(async (req, res) => {
  const { nombre, apellido, email, password, rol } = req.body;
  if (!nombre || !apellido || !email || !password || !rol) {
    throw new AppError('Faltan campos obligatorios (nombre, apellido, email, password, rol)', 400);
  }
  if (!esRolValido(rol)) throw new AppError('Rol inválido', 400);
  if (password.length < 6) throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);

  const existente = await userModel.findByEmail(email.toLowerCase().trim());
  if (existente) throw new AppError('Ya existe una cuenta con ese email', 409);

  const password_hash = await bcrypt.hash(password, 10);
  const user = await userModel.create({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: email.toLowerCase().trim(),
    password_hash,
    rol,
  });
  res.status(201).json({ user });
});

// Editar email y/o resetear contraseña de cualquier cuenta (alumno,
// profesor o admin) — no hay autoservicio para esto todavía (ver decisión
// en README: cambios de cuenta quedan centralizados acá, no en /perfil),
// así que es la única vía si alguien pierde acceso a su cuenta o necesita
// corregir un email mal cargado. Ambos campos son opcionales e
// independientes: se puede mandar solo uno de los dos.
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;
  if (email === undefined && password === undefined) {
    throw new AppError('Mandá al menos un email o una contraseña nueva', 400);
  }

  const user = await userModel.findById(id);
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const patch = {};
  if (email !== undefined) {
    const emailNormalizado = email.toLowerCase().trim();
    if (!emailNormalizado) throw new AppError('El email no puede quedar vacío', 400);
    const existente = await userModel.findByEmail(emailNormalizado);
    if (existente && existente.id !== user.id) {
      throw new AppError('Ya existe otra cuenta con ese email', 409);
    }
    patch.email = emailNormalizado;
  }
  if (password !== undefined) {
    if (password.length < 6) throw new AppError('La contraseña debe tener al menos 6 caracteres', 400);
    patch.password_hash = await bcrypt.hash(password, 10);
  }

  await userModel.updateEmailPassword(id, patch);
  // Si se resetea la contraseña, cerramos todas sus sesiones abiertas: si
  // el motivo del reset era una cuenta comprometida, dejar la sesión
  // vieja funcionando anularía el sentido del cambio (ver comentario en
  // loginLogModel.revocarTodasDeUsuario). Un simple cambio de email no
  // fuerza logout — no hace falta, no es un evento de seguridad en sí.
  if (patch.password_hash) {
    await loginLogModel.revocarTodasDeUsuario(id).catch((e) => console.error('[login_logs]', e.message));
  }

  const actualizado = await userModel.findPublicById(id);
  res.json({ user: actualizado });
});

// --- Cursos (el admin puede crear/editar cualquiera, asignando profesor) ---

const listCourses = asyncHandler(async (req, res) => {
  const courses = await courseModel.listAll();
  res.json({ courses });
});

const createCourse = asyncHandler(async (req, res) => {
  const { titulo, descripcion, precio, categoria, imagen_url, profesor_id, estado } = req.body;
  if (!titulo || !descripcion) throw new AppError('Faltan título y/o descripción del curso', 400);
  if (!profesor_id) throw new AppError('Falta asignar un profesor al curso', 400);
  if (estado !== undefined && !ESTADOS_CURSO.includes(estado)) {
    throw new AppError(`Estado inválido. Válidos: ${ESTADOS_CURSO.join(', ')}`, 400);
  }

  const profesor = await userModel.findById(profesor_id);
  if (!profesor || profesor.rol !== 'profesor') {
    throw new AppError('El profesor seleccionado no existe o no tiene rol de profesor', 400);
  }

  const [id] = await courseModel.create({
    titulo,
    descripcion,
    precio: precio || 0,
    categoria,
    imagen_url,
    profesor_id,
    ...(estado !== undefined ? { estado } : {}),
  });
  const course = await courseModel.findById(id);
  res.status(201).json({ course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseModel.findById(req.params.id);
  if (!course) throw new AppError('Curso no encontrado', 404);

  const { titulo, descripcion, precio, categoria, imagen_url, profesor_id, estado } = req.body;
  if (estado !== undefined && !ESTADOS_CURSO.includes(estado)) {
    throw new AppError(`Estado inválido. Válidos: ${ESTADOS_CURSO.join(', ')}`, 400);
  }

  const patch = {};
  if (titulo !== undefined) patch.titulo = titulo;
  if (descripcion !== undefined) patch.descripcion = descripcion;
  if (precio !== undefined) patch.precio = precio;
  if (categoria !== undefined) patch.categoria = categoria;
  if (imagen_url !== undefined) patch.imagen_url = imagen_url;
  if (estado !== undefined) patch.estado = estado;

  if (profesor_id !== undefined) {
    const profesor = await userModel.findById(profesor_id);
    if (!profesor || profesor.rol !== 'profesor') {
      throw new AppError('El profesor seleccionado no existe o no tiene rol de profesor', 400);
    }
    patch.profesor_id = profesor_id;
  }

  await courseModel.update(req.params.id, patch);
  const actualizado = await courseModel.findById(req.params.id);
  res.json({ course: actualizado });
});

// --- Contenido del sitio (textos e imágenes editables) ---

const listContent = asyncHandler(async (req, res) => {
  const content = await contentModel.listAll();
  res.json({ content });
});

const updateContent = asyncHandler(async (req, res) => {
  const { clave } = req.params;
  const { tipo, valor } = req.body;
  if (valor === undefined) throw new AppError('Falta el valor', 400);
  if (tipo !== undefined && !esTipoValido(tipo)) throw new AppError('Tipo de contenido inválido', 400);
  const actualizado = await contentModel.upsert(clave, { tipo, valor });
  res.json({ content: actualizado });
});

// --- Subida de imágenes (portadas de curso y contenido del sitio) ---

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Falta el archivo de imagen', 400);
  const url = storageService.buildPublicUrl('imagenes', req.file.filename);
  res.status(201).json({ url });
});

// --- Calendario (registro de todos los turnos alumno-profesor) ---

const listCalendarEvents = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const eventos = await calendarModel.listAll({ estado });
  res.json({ eventos });
});

// --- Links de menú/footer (además de la navegación funcional del código) ---

const listNavLinks = asyncHandler(async (req, res) => {
  const links = await navLinkModel.listAll();
  res.json({ links });
});

const createNavLink = asyncHandler(async (req, res) => {
  const { ubicacion, texto, url, orden } = req.body;
  if (!['menu', 'footer'].includes(ubicacion)) throw new AppError('Ubicación inválida (debe ser "menu" o "footer")', 400);
  if (!texto || !url) throw new AppError('Faltan el texto y/o el link', 400);
  const [id] = await navLinkModel.create({ ubicacion, texto, url, orden: orden || 0 });
  res.status(201).json({ link: await navLinkModel.findById(id) });
});

const updateNavLink = asyncHandler(async (req, res) => {
  const existente = await navLinkModel.findById(req.params.id);
  if (!existente) throw new AppError('Link no encontrado', 404);
  const { ubicacion, texto, url, orden } = req.body;
  if (ubicacion !== undefined && !['menu', 'footer'].includes(ubicacion)) {
    throw new AppError('Ubicación inválida (debe ser "menu" o "footer")', 400);
  }
  const patch = {};
  if (ubicacion !== undefined) patch.ubicacion = ubicacion;
  if (texto !== undefined) patch.texto = texto;
  if (url !== undefined) patch.url = url;
  if (orden !== undefined) patch.orden = orden;
  await navLinkModel.update(req.params.id, patch);
  res.json({ link: await navLinkModel.findById(req.params.id) });
});

const deleteNavLink = asyncHandler(async (req, res) => {
  const existente = await navLinkModel.findById(req.params.id);
  if (!existente) throw new AppError('Link no encontrado', 404);
  await navLinkModel.remove(req.params.id);
  res.json({ ok: true });
});

// --- Registro de botones ("Opción N") reutilizable en cualquier página ---

const listButtonOptions = asyncHandler(async (req, res) => {
  const opciones = await buttonOptionModel.listAll();
  res.json({ opciones });
});

const createButtonOption = asyncHandler(async (req, res) => {
  const { color_fondo, color_texto, link } = req.body;
  if (!link) throw new AppError('Falta el link de destino', 400);
  const [id] = await buttonOptionModel.create({
    color_fondo: color_fondo || '#16324a',
    color_texto: color_texto || '#ffffff',
    link,
  });
  res.status(201).json({ opcion: await buttonOptionModel.findById(id) });
});

const updateButtonOption = asyncHandler(async (req, res) => {
  const existente = await buttonOptionModel.findById(req.params.id);
  if (!existente) throw new AppError('Opción de botón no encontrada', 404);
  const { color_fondo, color_texto, link } = req.body;
  const patch = {};
  if (color_fondo !== undefined) patch.color_fondo = color_fondo;
  if (color_texto !== undefined) patch.color_texto = color_texto;
  if (link !== undefined) patch.link = link;
  await buttonOptionModel.update(req.params.id, patch);
  res.json({ opcion: await buttonOptionModel.findById(req.params.id) });
});

const deleteButtonOption = asyncHandler(async (req, res) => {
  const existente = await buttonOptionModel.findById(req.params.id);
  if (!existente) throw new AppError('Opción de botón no encontrada', 404);
  await buttonOptionModel.remove(req.params.id);
  res.json({ ok: true });
});

// --- Errores del sistema (solo lectura) ---

const listErrorLogs = asyncHandler(async (req, res) => {
  const { desde, hasta, page } = req.query;
  const { rows, total } = await errorLogModel.listPage({ desde, hasta, page });
  res.json({
    errores: rows,
    total,
    page: Math.max(1, Number(page) || 1),
    totalPages: Math.max(1, Math.ceil(total / errorLogModel.PAGE_SIZE)),
  });
});

// Vacía el registro de errores — irreversible, el front lo confirma con el
// admin antes de llamar a esto.
const clearErrorLogs = asyncHandler(async (req, res) => {
  await errorLogModel.clearAll();
  res.json({ ok: true });
});

// --- Registro de logins (solo lectura, filtrable) ---

const listLoginLogs = asyncHandler(async (req, res) => {
  const { userId, desde, hasta } = req.query;
  const logins = await loginLogModel.listAll({ userId, desde, hasta });
  res.json({ logins });
});

// Fuerza el cierre de una sesión ajena desde el historial de logins. A
// partir de acá, el próximo request que llegue con ese token va a
// rebotar con 401 en requireAuth (ver auth.middleware.js) — no hace falta
// esperar a que el JWT expire solo.
const revocarSesion = asyncHandler(async (req, res) => {
  const sesion = await loginLogModel.revocar(req.params.id);
  if (!sesion) throw new AppError('Sesión no encontrada', 404);
  res.json({ sesion });
});

// --- Registro de chats de soporte (solo lectura — responder es cosa del
// panel de soporte, /soporte, no del admin) ---

const listChats = asyncHandler(async (req, res) => {
  const { estado } = req.query;
  const conversaciones = await chatConversationModel.listConDetalle({ estado });
  res.json({ conversaciones });
});

const listChatMessages = asyncHandler(async (req, res) => {
  const conversacion = await chatConversationModel.findById(req.params.id);
  if (!conversacion) throw new AppError('Conversación no encontrada', 404);
  const mensajes = await chatMessageModel.listByConversation(req.params.id);
  res.json({ conversacion, mensajes });
});

module.exports = {
  getDashboard,
  listUsersByRole,
  createUser,
  listCourses,
  createCourse,
  updateCourse,
  listContent,
  updateContent,
  uploadImage,
  listCalendarEvents,
  listNavLinks,
  createNavLink,
  updateNavLink,
  deleteNavLink,
  listButtonOptions,
  createButtonOption,
  updateButtonOption,
  deleteButtonOption,
  listErrorLogs,
  clearErrorLogs,
  updateUser,
  listLoginLogs,
  revocarSesion,
  listChats,
  listChatMessages,
};
