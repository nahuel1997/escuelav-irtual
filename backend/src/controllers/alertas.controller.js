// Lado "destinatario" de Alertas (alumno/profesor) — el alta y el
// historial completo son del admin, ver seguridad.controller.js.
const alertaModel = require('../models/alerta.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Se llama una sola vez al entrar a la app (ver frontend AlertaPopup.jsx,
// montado desde Layout.jsx): si hay alguna alerta nueva la devuelve para
// mostrarla como pop-up, y de paso marca TODAS las pendientes de este
// usuario como ya mostradas — así no vuelve a aparecer en la próxima
// carga de página, aunque haya más de una esperando (las demás quedan
// igual disponibles en "mias", más abajo).
const pendiente = asyncHandler(async (req, res) => {
  const alerta = await alertaModel.pendienteMasReciente(req.user.id);
  if (alerta) await alertaModel.marcarMostradas(req.user.id);
  res.json({ alerta: alerta || null });
});

// Historial propio — pestaña "Alertas" del alumno/profesor, para volver a
// leer algo que ya vio como pop-up (o que ni llegó a ver como tal).
const mias = asyncHandler(async (req, res) => {
  const alertas = await alertaModel.listByUser(req.user.id);
  res.json({ alertas });
});

// "Recibido": el destinatario confirma que leyó el aviso (el admin lo ve
// en el historial). Solo sobre alertas propias.
const recibido = asyncHandler(async (req, res) => {
  const cambiadas = await alertaModel.marcarRecibido(req.params.id, req.user.id);
  if (!cambiadas) {
    const propias = await alertaModel.listByUser(req.user.id);
    if (!propias.some((a) => String(a.id) === String(req.params.id))) throw new AppError('Alerta no encontrada', 404);
  }
  res.json({ ok: true });
});

const contador = asyncHandler(async (req, res) => {
  res.json({ sinRecibir: await alertaModel.contarSinRecibir(req.user.id) });
});

module.exports = { pendiente, mias, recibido, contador };
