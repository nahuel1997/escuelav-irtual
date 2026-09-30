// =============================================================================
// storage.service.js — Dónde y cómo se guardan los archivos que sube la
// app (entregas de tareas, imágenes de cursos y de contenido del sitio).
//
// TRADE-OFF: hoy todo vive en disco local (backend/uploads/). Mismo
// criterio que payments.service.js con los pagos: se aísla en un único
// archivo, con una única forma de pedir "una carpeta para guardar" y "la
// URL pública de un archivo guardado", para que conectar un storage
// externo el día de mañana sea cambiar ESTE archivo y nada más — multer,
// los controllers y los modelos no necesitan saber dónde termina viviendo
// el archivo, porque solo conocen la URL que devuelve buildPublicUrl().
//
// Por qué disco local no alcanza para producción con más de una instancia:
// si la app corre en más de un servidor (o el hosting recrea el
// contenedor/instancia), lo que se guardó en disco se pierde o queda
// repartido de forma inconsistente entre instancias — el alumno entrega
// una tarea, el servidor que la recibió se reinicia, y la entrega
// desaparece aunque la fila en la base siga ahí.
//
// Cómo se conectaría S3 más adelante (queda comentado como guía, mismo
// espíritu que la guía de Mercado Pago en payments.service.js):
//
//   const { S3Client } = require('@aws-sdk/client-s3');
//   const multerS3 = require('multer-s3');
//   const s3 = new S3Client({ region: env.AWS_REGION });
//
//   function multerStorage(carpetaNombre) {
//     if (env.STORAGE_DRIVER !== 's3') return storageEnDisco(carpetaNombre); // como hoy
//     return multerS3({
//       s3,
//       bucket: env.AWS_BUCKET,
//       key: (req, file, cb) => cb(null, `${carpetaNombre}/${nombreUnico(file)}`),
//     });
//   }
//
//   Y buildPublicUrl() pasaría a devolver la URL de S3/CloudFront en vez de
//   una ruta relativa a este mismo servidor. upload.middleware.js y los
//   controllers que llaman a buildPublicUrl() no cambiarían ni una línea.
// =============================================================================
const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

// Devuelve (creándola si hace falta) la carpeta local para una categoría de
// archivo ("tareas", "imagenes"). Cada categoría vive separada para poder
// aplicarle límites/reglas distintas en upload.middleware.js.
function carpeta(nombre) {
  const dir = path.join(UPLOADS_ROOT, nombre);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Nombre de archivo único, para que dos alumnos subiendo "tarea1.js" el
// mismo segundo no se pisen entre sí.
function nombreUnico(file) {
  const unico = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const ext = path.extname(file.originalname);
  return `${unico}${ext}`;
}

// URL pública con la que el frontend accede al archivo. Hoy es relativa a
// este mismo servidor (app.js sirve /uploads como estático); si se migra a
// S3, esta es la única función que cambiaría (devolvería la URL del
// bucket/CDN en vez de una ruta local).
function buildPublicUrl(carpetaNombre, filename) {
  return `/uploads/${carpetaNombre}/${filename}`;
}

// Archivos PRIVADOS (capturas de "Reportar error", adjuntos de tickets,
// backups): viven fuera de uploads/ — que se sirve como estático, o sea
// público para cualquiera que adivine la URL — y solo se entregan por un
// endpoint que chequea permisos (mismo criterio que uploads/reportes-error
// fuera de public/ en DBA24).
// Los tests escriben en data/privado-test (se borra al terminar), nunca en
// la carpeta real.
const PRIVADO_ROOT = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, '..', '..', 'data', 'privado-test')
  : path.join(__dirname, '..', '..', 'privado');

function carpetaPrivada(nombre) {
  const dir = path.join(PRIVADO_ROOT, nombre);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Ruta absoluta de un archivo privado ya guardado. `archivo` sale siempre
// de la base (lo generó nombreUnico), pero igual se descarta cualquier
// separador para que nunca pueda salirse de su carpeta.
function rutaPrivada(nombre, archivo) {
  return path.join(carpetaPrivada(nombre), path.basename(String(archivo)));
}

module.exports = { carpeta, nombreUnico, buildPublicUrl, carpetaPrivada, rutaPrivada, PRIVADO_ROOT, UPLOADS_ROOT };
