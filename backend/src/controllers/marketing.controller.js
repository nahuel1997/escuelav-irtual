// =============================================================================
// marketing.controller.js — Campañas de mail programadas y ofertas en la
// app: el ABM del admin, lo público de las ofertas (qué mostrar y sus
// eventos) y el seguimiento de las campañas (apertura, click, baja).
// =============================================================================
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const campanias = require('../services/campanias.service');
const ofertas = require('../services/ofertas.service');
const { asyncHandler } = require('../middlewares/error.middleware');

// --- Campañas (admin) ---

const listCampanias = asyncHandler(async (req, res) => res.json({ campanias: await campanias.listar() }));
const verCampania = asyncHandler(async (req, res) => res.json({ campania: await campanias.obtener(req.params.id) }));
const crearCampania = asyncHandler(async (req, res) => res.status(201).json({ id: await campanias.crear(req.body || {}, req.user.id) }));
const editarCampania = asyncHandler(async (req, res) => { await campanias.editar(req.params.id, req.body || {}); res.json({ ok: true }); });
const borrarCampania = asyncHandler(async (req, res) => { await campanias.borrar(req.params.id); res.json({ ok: true }); });
const duplicarCampania = asyncHandler(async (req, res) => res.status(201).json({ id: await campanias.duplicar(req.params.id, req.user.id) }));
const programarCampania = asyncHandler(async (req, res) => { await campanias.programar(req.params.id, (req.body || {}).programada_para); res.json({ ok: true }); });
const cancelarCampania = asyncHandler(async (req, res) => { await campanias.cancelar(req.params.id); res.json({ ok: true }); });
const enviarAhora = asyncHandler(async (req, res) => res.status(201).json({ proceso: await campanias.lanzar(req.params.id, req.user) }));
const pruebaCampania = asyncHandler(async (req, res) => res.json({ enviadoA: await campanias.enviarPrueba(req.params.id, (req.body || {}).destinatario, req.user) }));
const estadisticasCampania = asyncHandler(async (req, res) => res.json(await campanias.estadisticas(req.params.id)));
const contarSegmento = asyncHandler(async (req, res) => res.json({ destinatarios: await campanias.contarDestinatarios((req.body || {}).segmento) }));

// La vista previa se muestra dentro de un iframe con sandbox en el panel.
const vistaPrevia = asyncHandler(async (req, res) => {
  const html = await campanias.vistaPrevia(req.params.id);
  res.set('Content-Security-Policy', "default-src 'none'; img-src * data:; style-src 'unsafe-inline'");
  res.type('html').send(html);
});

// --- Seguimiento de campañas (público, el token es la credencial) ---

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const pixelApertura = asyncHandler(async (req, res) => {
  await campanias.registrarApertura(String(req.params.token).replace(/\.gif$/, '')).catch(() => {});
  res.set('Cache-Control', 'no-store');
  res.type('gif').send(GIF);
});

const click = asyncHandler(async (req, res) => {
  res.redirect(302, await campanias.registrarClick(req.params.token));
});

const infoBaja = asyncHandler(async (req, res) => res.json(await campanias.infoBaja(req.params.token)));
const darDeBaja = asyncHandler(async (req, res) => { await campanias.darDeBaja(req.params.token); res.json({ ok: true }); });

// --- Ofertas (admin) ---

const listOfertas = asyncHandler(async (req, res) => res.json({ ofertas: await ofertas.listar() }));
const crearOferta = asyncHandler(async (req, res) => res.status(201).json({ id: await ofertas.crear(req.body || {}, req.user.id) }));
const editarOferta = asyncHandler(async (req, res) => { await ofertas.editar(req.params.id, req.body || {}); res.json({ ok: true }); });
const borrarOferta = asyncHandler(async (req, res) => { await ofertas.borrar(req.params.id); res.json({ ok: true }); });

// --- Ofertas (público: visitantes y usuarios logueados) ---

function usuarioOpcional(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  try { return jwt.verify(token, env.JWT_SECRET); } catch (_e) { return null; }
}

const ofertasActivas = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ofertas: await ofertas.activasPara(usuarioOpcional(req)), ahora: new Date().toISOString() });
});

const eventoOferta = asyncHandler(async (req, res) => {
  await ofertas.registrarEvento({ ofertaId: Number(req.params.id), tipo: (req.body || {}).tipo, user: usuarioOpcional(req), visitante: (req.body || {}).visitante });
  res.json({ ok: true });
});

module.exports = {
  listCampanias, verCampania, crearCampania, editarCampania, borrarCampania, duplicarCampania,
  programarCampania, cancelarCampania, enviarAhora, pruebaCampania, estadisticasCampania, contarSegmento, vistaPrevia,
  pixelApertura, click, infoBaja, darDeBaja,
  listOfertas, crearOferta, editarOferta, borrarOferta, ofertasActivas, eventoOferta,
};
