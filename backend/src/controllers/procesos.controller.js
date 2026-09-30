// Procesos en segundo plano — ver services/procesos/index.js.
const fs = require('fs');
const procesos = require('../services/procesos');
const storage = require('../services/storage.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

async function propio(req) {
  const p = await procesos.obtener(req.params.id);
  if (!p || (req.user.rol !== 'admin' && p.user_id !== req.user.id)) throw new AppError('Proceso no encontrado', 404);
  return p;
}

const crear = asyncHandler(async (req, res) => {
  const { tipo, parametros } = req.body || {};
  res.status(201).json({ proceso: await procesos.encolar({ tipo, parametros, user: req.user }) });
});

const mios = asyncHandler(async (req, res) => {
  res.json({ procesos: await procesos.listar({ userId: req.user.id, limite: 50 }) });
});

const ver = asyncHandler(async (req, res) => {
  res.json({ proceso: procesos.publico(await propio(req)) });
});

const archivo = asyncHandler(async (req, res) => {
  const p = await propio(req);
  if (p.estado !== 'terminado' || !p.archivo) throw new AppError('Este proceso no generó ningún archivo', 404);
  const ruta = storage.rutaPrivada('procesos', p.archivo);
  if (!fs.existsSync(ruta)) throw new AppError('El archivo ya no está disponible (se borran a los 7 días)', 410);
  res.type(p.archivo_mime || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(p.archivo_nombre || p.archivo)}"`);
  fs.createReadStream(ruta).pipe(res);
});

const cancelar = asyncHandler(async (req, res) => {
  await procesos.cancelar(req.params.id, req.user);
  res.json({ ok: true });
});

// --- Admin ---

const listarTodos = asyncHandler(async (req, res) => {
  const { estado, tipo } = req.query;
  res.json({ procesos: await procesos.listar({ estado, tipo, limite: 300 }), tipos: Object.keys(procesos.TIPOS) });
});

const reintentar = asyncHandler(async (req, res) => {
  await procesos.reintentar(req.params.id);
  res.json({ ok: true });
});

module.exports = { crear, mios, ver, archivo, cancelar, listarTodos, reintentar };
