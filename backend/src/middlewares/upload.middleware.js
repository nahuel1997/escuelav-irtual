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

module.exports = { uploadTarea, uploadImagen, uploadArchivoUtil };
