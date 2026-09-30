// =============================================================================
// operacion.controller.js — Estado de la app, Tráfico y Versiones del panel
// de admin (portado de estadoAppController / traficoController /
// versionesController de DBA24). Cada pantalla exporta a PDF.
// =============================================================================
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const metricas = require('../services/metricas.service');
const presencia = require('../services/presencia.service');
const traficoModel = require('../models/trafico.model');
const { generarPdf, enviarPdf } = require('../utils/pdfReporte');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// --- Estado de la app ---

const getEstado = asyncHandler(async (req, res) => {
  const [actual, serie] = await Promise.all([metricas.snapshot(), metricas.serie(Number(req.query.dias) || 30)]);
  res.json({ actual, serie });
});

const postTestVelocidad = asyncHandler(async (req, res) => {
  res.json(await metricas.testVelocidad());
});

const getEstadoPdf = asyncHandler(async (req, res) => {
  const a = await metricas.snapshot();
  const serie = await metricas.serie(30);
  const prom = (campo) => (serie.length ? Math.round((serie.reduce((s, x) => s + (Number(x[campo]) || 0), 0) / serie.length) * 10) / 10 : '—');
  const buffer = await generarPdf({
    titulo: 'Estado de la app',
    subtitulo: 'Escuela Online',
    bloques: [
      { tipo: 'titulo', texto: 'Servidor' },
      { tipo: 'pares', filas: [
        ['Node', a.servidor.node], ['Plataforma', a.servidor.plataforma], ['Núcleos', a.servidor.nucleos],
        ['Memoria total / libre', `${a.servidor.memoriaTotalMb} MB / ${a.servidor.memoriaLibreMb} MB`],
        ['Proceso activo hace', `${a.servidor.uptimeProcesoMin} min`], ['Base de datos', a.servidor.baseDeDatos],
      ] },
      { tipo: 'titulo', texto: 'Proceso de la app' },
      { tipo: 'pares', filas: [
        ['Memoria (RSS)', `${a.proceso.rssMb} MB`], ['Heap usado', `${a.proceso.heapUsadoMb} MB`], ['CPU', `${a.proceso.cpuPorcentaje} %`],
        ['Event loop (prom / p99 / máx)', `${a.eventLoop.promMs} / ${a.eventLoop.p99Ms} / ${a.eventLoop.maxMs} ms`],
        ['Latencia de la base', a.baseLatenciaMs == null ? '—' : `${a.baseLatenciaMs} ms`],
      ] },
      { tipo: 'titulo', texto: 'Última hora' },
      { tipo: 'pares', filas: [
        ['Requests', a.ultimaHora.requests], ['Latencia promedio', `${a.ultimaHora.latenciaPromMs} ms`], ['Errores 5xx', a.ultimaHora.errores5xx],
        ['Usuarios en línea', a.app.usuariosOnline], ['Errores distintos (24 h)', a.app.errores24h], ['Procesos en cola', a.app.procesosPendientes],
      ] },
      { tipo: 'titulo', texto: 'Rutas más lentas' },
      { tipo: 'tabla', columnas: [{ titulo: 'Ruta', ancho: 4 }, { titulo: 'Requests' }, { titulo: 'Prom (ms)' }, { titulo: 'Máx (ms)' }], filas: a.rutasMasLentas.map((r) => [r.ruta, r.requests, r.promMs, r.maxMs]) },
      { tipo: 'titulo', texto: 'Disco' },
      { tipo: 'pares', filas: Object.entries(a.disco).map(([k, v]) => [k, `${v.mb} MB en ${v.archivos} archivos`]) },
      { tipo: 'titulo', texto: `Promedios de los últimos 30 días (${serie.length} mediciones horarias)` },
      { tipo: 'pares', filas: [
        ['Memoria (RSS)', `${prom('rss_mb')} MB`], ['CPU', `${prom('carga_cpu')} %`], ['Event loop p99', `${prom('lag_p99_ms')} ms`],
        ['Requests por hora', prom('requests')], ['Latencia promedio', `${prom('latencia_prom_ms')} ms`], ['Usuarios en línea', prom('usuarios_online')],
      ] },
    ],
  });
  enviarPdf(res, buffer, `estado-app-${new Date().toISOString().slice(0, 10)}.pdf`);
});

// --- Tráfico ---

function rangoDe(q) {
  const hasta = q.hasta ? new Date(`${q.hasta}T23:59:59`) : new Date();
  const desde = q.desde ? new Date(`${q.desde}T00:00:00`) : new Date(hasta.getTime() - 29 * 86400000);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) throw new AppError('Fechas inválidas', 400);
  if (desde > hasta) throw new AppError('"Desde" no puede ser posterior a "hasta"', 400);
  return { desde, hasta };
}

const getTrafico = asyncHandler(async (req, res) => {
  const r = rangoDe(req.query);
  const [resumen, ultimos] = await Promise.all([traficoModel.resumen(r), traficoModel.ultimos(50)]);
  res.json({ online: presencia.online(), resumen, ultimos, desde: r.desde, hasta: r.hasta });
});

const getTraficoPdf = asyncHandler(async (req, res) => {
  const r = rangoDe(req.query);
  const t = await traficoModel.resumen(r);
  const buffer = await generarPdf({
    titulo: 'Tráfico del sitio',
    subtitulo: `Del ${r.desde.toLocaleDateString('es-AR')} al ${r.hasta.toLocaleDateString('es-AR')}`,
    bloques: [
      { tipo: 'pares', filas: [['Páginas vistas', t.totalVistas], ['Personas distintas', t.personasUnicas], ['En línea ahora', presencia.online().length]] },
      { tipo: 'titulo', texto: 'Por día' },
      { tipo: 'tabla', columnas: [{ titulo: 'Día' }, { titulo: 'Vistas' }, { titulo: 'Personas' }], filas: t.porDia.map((d) => [d.dia, d.vistas, d.personas]) },
      { tipo: 'titulo', texto: 'Páginas más vistas' },
      { tipo: 'tabla', columnas: [{ titulo: 'Página', ancho: 4 }, { titulo: 'Vistas' }], filas: t.paginas.map((p) => [p.pagina, p.vistas]) },
      { tipo: 'titulo', texto: 'Por tipo de usuario' },
      { tipo: 'pares', filas: Object.entries(t.porRol) },
      { tipo: 'titulo', texto: 'Por dispositivo' },
      { tipo: 'pares', filas: Object.entries(t.porDispositivo) },
      { tipo: 'titulo', texto: 'Por hora del día' },
      { tipo: 'tabla', columnas: [{ titulo: 'Hora' }, { titulo: 'Vistas' }], filas: t.porHora.filter((h) => h.vistas).map((h) => [`${String(h.hora).padStart(2, '0')}:00`, h.vistas]) },
    ],
  });
  enviarPdf(res, buffer, `trafico-${new Date().toISOString().slice(0, 10)}.pdf`);
});

// POST /api/app/vista — el frontend avisa cada cambio de pantalla. Público
// (también cuenta visitantes sin sesión): si viene un token válido se usa
// para saber quién es, si no, solo el id anónimo del navegador.
const RUTA_VALIDA = /^\/[A-Za-z0-9/_\-.:]*$/;
const postVista = asyncHandler(async (req, res) => {
  const pagina = String(req.body.pagina || '').split('?')[0].slice(0, 300)
    // ids y tokens fuera, para agrupar "la misma pantalla"
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[A-Za-z0-9_-]{24,}(?=\/|$)/g, '/:token');
  if (!pagina || !RUTA_VALIDA.test(pagina)) throw new AppError('Página inválida', 400);
  if (pagina.startsWith('/admin-panel') || pagina.startsWith('/soporte')) return res.json({ ok: true }); // el backoffice no cuenta como tráfico

  let user = null;
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme === 'Bearer' && token) {
    try { user = jwt.verify(token, env.JWT_SECRET); } catch (_e) { user = null; }
  }
  const ua = String(req.headers['user-agent'] || '');
  const dispositivo = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'celular' : 'escritorio';
  const visitante = /^[A-Za-z0-9-]{8,64}$/.test(String(req.body.visitante || '')) ? req.body.visitante : null;
  let referencia = null;
  try { referencia = req.body.referencia ? new URL(String(req.body.referencia)).hostname.slice(0, 300) : null; } catch (_e) { referencia = null; }

  await traficoModel.registrarVista({ userId: user?.id, rol: user?.rol, visitante, pagina, referencia, dispositivo });
  res.json({ ok: true });
});

// --- Versiones (changelog) ---

function validarVersion(b) {
  const version = String(b.version || '').trim();
  const titulo = String(b.titulo || '').trim();
  const cambios = String(b.cambios || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const fecha = String(b.fecha || '').slice(0, 10);
  if (!/^[0-9A-Za-z.\-_]{1,30}$/.test(version)) throw new AppError('Versión inválida (ej: 1.4.0)', 400);
  if (!titulo) throw new AppError('Falta el título', 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new AppError('Fecha inválida', 400);
  if (!cambios.length) throw new AppError('Cargá al menos un cambio (uno por línea)', 400);
  return { version, titulo: titulo.slice(0, 200), fecha, cambios: cambios.join('\n').slice(0, 20000) };
}

const listVersiones = asyncHandler(async (req, res) => {
  res.json({ versiones: await db('versiones').select('*').orderBy('fecha', 'desc').orderBy('id', 'desc') });
});

const crearVersion = asyncHandler(async (req, res) => {
  const v = validarVersion(req.body);
  if (await db('versiones').where({ version: v.version }).first()) throw new AppError('Ya existe esa versión', 409);
  const [id] = await db('versiones').insert(v);
  res.status(201).json({ version: await db('versiones').where({ id: typeof id === 'object' ? id.id : id }).first() });
});

const editarVersion = asyncHandler(async (req, res) => {
  const existente = await db('versiones').where({ id: req.params.id }).first();
  if (!existente) throw new AppError('Versión no encontrada', 404);
  const v = validarVersion(req.body);
  const otra = await db('versiones').where({ version: v.version }).whereNot({ id: existente.id }).first();
  if (otra) throw new AppError('Ya existe esa versión', 409);
  await db('versiones').where({ id: existente.id }).update({ ...v, updated_at: db.fn.now() });
  res.json({ version: await db('versiones').where({ id: existente.id }).first() });
});

const borrarVersion = asyncHandler(async (req, res) => {
  await db('versiones').where({ id: req.params.id }).del();
  res.json({ ok: true });
});

const getVersionesPdf = asyncHandler(async (req, res) => {
  const versiones = await db('versiones').select('*').orderBy('fecha', 'desc').orderBy('id', 'desc');
  const bloques = [];
  versiones.forEach((v) => {
    bloques.push({ tipo: 'titulo', texto: `${v.version} — ${v.titulo}` });
    bloques.push({ tipo: 'parrafo', texto: new Date(`${String(v.fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR') });
    bloques.push({ tipo: 'lista', items: String(v.cambios).split('\n') });
  });
  if (!versiones.length) bloques.push({ tipo: 'parrafo', texto: 'Todavía no hay versiones cargadas.' });
  enviarPdf(res, await generarPdf({ titulo: 'Registro de versiones', subtitulo: 'Escuela Online', bloques }), 'versiones.pdf');
});

// Versiones visibles para cualquier usuario logueado ("Novedades").
const novedades = asyncHandler(async (req, res) => {
  res.json({ versiones: await db('versiones').select('version', 'fecha', 'titulo', 'cambios').orderBy('fecha', 'desc').orderBy('id', 'desc').limit(20) });
});

module.exports = {
  getEstado,
  postTestVelocidad,
  getEstadoPdf,
  getTrafico,
  getTraficoPdf,
  postVista,
  listVersiones,
  crearVersion,
  editarVersion,
  borrarVersion,
  getVersionesPdf,
  novedades,
};
