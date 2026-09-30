// Configuración de multer para recibir archivos (entregas de tareas e
// imágenes del panel de admin). Dónde se guardan y cómo se arma la URL
// pública vive en storage.service.js — acá solo se conecta multer con esas
// funciones, para que cambiar de storage el día de mañana no toque este
// archivo (ver comentario largo en storage.service.js).
const multer = require('multer');
const storageService = require('../services/storage.service');

const storageTareas = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageService.carpeta('tareas')),
  filename: (req, file, cb) => cb(null, storageService.nombreUnico(file)),
});

// Límite de 15MB por archivo y solo un archivo por entrega.
const uploadTarea = multer({
  storage: storageTareas,
  limits: { fileSize: 15 * 1024 * 1024 },
}).single('archivo');

// --- Imágenes (panel de admin: portadas de curso, contenido del sitio) ---
const storageImagenes = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageService.carpeta('imagenes')),
  filename: (req, file, cb) => cb(null, storageService.nombreUnico(file)),
});

const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];

const uploadImagen = multer({
  storage: storageImagenes,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('Formato de imagen no soportado (usá JPG, PNG, WEBP, GIF o SVG)'));
    }
    cb(null, true);
  },
}).single('imagen');

// --- Archivos de utilidad de un capítulo (apuntes, código, planillas...) ---
const storageArchivosUtiles = multer.diskStorage({
  destination: (req, file, cb) => cb(null, storageService.carpeta('archivos-utiles')),
  filename: (req, file, cb) => cb(null, storageService.nombreUnico(file)),
});

// Sin filtro de tipo (a diferencia de las imágenes): puede ser código,
// PDFs, ZIPs, planillas, lo que el profesor necesite adjuntar. Límite más
// alto que una tarea porque puede ser un ZIP con varios archivos.
const uploadArchivoUtil = multer({
  storage: storageArchivosUtiles,
  limits: { fileSize: 25 * 1024 * 1024 },
}).single('archivo');

// --- Privados: capturas de "Reportar error" y adjuntos de tickets ---
// Van a backend/privado/ (no se sirven como estáticos) y se descargan solo
// por endpoints que chequean que quien pide sea el dueño o un admin.
function storagePrivado(nombre) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, storageService.carpetaPrivada(nombre)),
    filename: (req, file, cb) => cb(null, storageService.nombreUnico(file)),
  });
}

const TIPOS_CAPTURA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Hasta 5 capturas de 5 MB por reporte (mismo tope que DBA24).
const uploadCapturasReporte = multer({
  storage: storagePrivado('reportes-error'),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_CAPTURA.includes(file.mimetype)) return cb(new Error('Las capturas tienen que ser imágenes (JPG, PNG, WEBP o GIF)'));
    cb(null, true);
  },
}).array('capturas', 5);

// Adjuntos de tickets: imágenes, PDF, documentos y planillas, hasta 5 de 10 MB.
const TIPOS_ADJUNTO_TICKET = [
  ...TIPOS_CAPTURA,
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
];

const uploadAdjuntosTicket = multer({
  storage: storagePrivado('tickets'),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ADJUNTO_TICKET.includes(file.mimetype)) return cb(new Error('Tipo de archivo no permitido (imágenes, PDF, Word, Excel, TXT o ZIP)'));
    cb(null, true);
  },
}).array('adjuntos', 5);

// Adjuntos de las calificaciones internas de profesores (solo admin).
const uploadAdjuntosCalificacion = multer({
  storage: storagePrivado('calificaciones'),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ADJUNTO_TICKET.includes(file.mimetype)) return cb(new Error('Tipo de archivo no permitido (imágenes, PDF, Word, Excel, TXT o ZIP)'));
    cb(null, true);
  },
}).array('adjuntos', 5);

// Multer tira errores propios (archivo muy grande, demasiados archivos,
// tipo no permitido): se convierten en un 400 con mensaje claro en vez de
// terminar como un 500 genérico.
function conErroresClaros(mw) {
  return (req, res, next) => mw(req, res, (err) => {
    if (!err) return next();
    const { AppError } = require('./error.middleware');
    const mensajes = {
      LIMIT_FILE_SIZE: 'Algún archivo supera el tamaño máximo permitido',
      LIMIT_FILE_COUNT: 'Mandaste demasiados archivos (máximo 5)',
      LIMIT_UNEXPECTED_FILE: 'Mandaste demasiados archivos (máximo 5)',
    };
    next(new AppError(mensajes[err.code] || err.message, 400));
  });
}

module.exports = {
  uploadTarea,
  uploadImagen,
  uploadArchivoUtil,
  uploadCapturasReporte: conErroresClaros(uploadCapturasReporte),
  uploadAdjuntosTicket: conErroresClaros(uploadAdjuntosTicket),
  uploadAdjuntosCalificacion: conErroresClaros(uploadAdjuntosCalificacion),
};
