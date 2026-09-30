// =============================================================================
// erroresApp.service.js — Registro de errores de la app para Admin → Errores
// (portado de services/erroresApp.js de DBA24).
//
// - Servidor: se captura TODO console.error (el errorHandler central, los
//   "best effort" de los controllers, los jobs) con la URL, el método y el
//   usuario de la request en la que pasó (AsyncLocalStorage).
// - Navegador: los errores de JS de las pantallas llegan por
//   POST /api/app/errores (frontend/src/utils/erroresNavegador.js).
//
// Los errores iguales se agrupan por huella y se escriben en lotes cada
// 5 s: un error que se repite mil veces es una fila con veces = 1000, y un
// problema de la base no genera una avalancha de escrituras. Nunca tira.
//
// En NODE_ENV=test no se engancha a console.error ni programa escrituras
// solas (los tests llaman a escribirAhora() cuando lo necesitan): si no, un
// lote pendiente podría intentar escribir después de que el test cerró la
// base.
// =============================================================================
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const contexto = new AsyncLocalStorage();
const consolaOriginal = console.error.bind(console);
const INTERVALO_MS = 5000;
const MAX_PENDIENTES = 200;
const MAX_MENSAJE = 2000;
const MAX_STACK = 8000;
const esTest = () => process.env.NODE_ENV === 'test';

let pendientes = new Map();
let escribiendo = false;
let pausadoHasta = 0;
let timer = null;

function recortar(s, n) {
  s = s == null ? '' : String(s);
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// Números, ids y hashes fuera: "Curso 12 no existe" y "Curso 40 no existe"
// son el mismo error.
function normalizar(s) {
  return String(s || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '#')
    .replace(/\b[0-9a-f]{16,}\b/gi, '#')
    .replace(/\d+/g, '#')
    .slice(0, 300);
}

function rutaSinIds(url) {
  return String(url || '').split('?')[0].replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/[0-9a-f-]{20,}(?=\/|$)/gi, '/:id');
}

// Primera línea del stack que es código propio (no node_modules ni node:).
function lugarDelStack(stack) {
  const lineas = String(stack || '').split('\n').map((l) => l.trim()).filter((l) => l.startsWith('at '));
  const propia = lineas.find((l) => !/node_modules|node:|internal\//.test(l)) || lineas[0] || '';
  return propia.replace(/:\d+:\d+\)?$/, '').replace(/^.*[\\/](backend|frontend)[\\/]/, '');
}

function huellaDe(r) {
  const base = [r.origen, r.contexto || '', normalizar(r.mensaje), rutaSinIds(r.url), lugarDelStack(r.stack)].join('|');
  return crypto.createHash('sha256').update(base).digest('hex');
}

function usuarioDelContexto() {
  const store = contexto.getStore();
  const u = store && store.req && store.req.user;
  return u ? { id: u.id, nombre: u.nombre || u.email, rol: u.rol } : null;
}

/**
 * Registra un error. Campos: origen ('servidor' | 'navegador'), mensaje,
 * stack, contexto, url, metodo, usuario {id, nombre, rol}, navegador,
 * detalle (objeto chico).
 */
function registrar(r) {
  try {
    if (!r || !r.mensaje) return;
    const store = contexto.getStore() || {};
    const req = store.req;
    const usuario = r.usuario || usuarioDelContexto();
    const reg = {
      origen: r.origen === 'navegador' ? 'navegador' : 'servidor',
      mensaje: recortar(r.mensaje, MAX_MENSAJE),
      stack: r.stack ? recortar(r.stack, MAX_STACK) : null,
      contexto: r.contexto ? recortar(r.contexto, 200) : null,
      url: recortar(r.url || (req && req.originalUrl) || '', 500) || null,
      metodo: recortar(r.metodo || (req && req.method) || '', 10) || null,
      usuario_id: usuario && usuario.id ? usuario.id : null,
      usuario_nombre: usuario ? recortar(usuario.nombre || '', 200) || null : null,
      rol: usuario && usuario.rol ? String(usuario.rol).slice(0, 20) : null,
      navegador: recortar(r.navegador || (req && req.headers['user-agent']) || '', 300) || null,
      detalle: r.detalle || null,
    };
    const huella = huellaDe(reg);
    const previo = pendientes.get(huella);
    if (previo) {
      const veces = previo.veces + 1;
      Object.assign(previo, reg, { veces }); // se queda con los datos de la última vez
    } else {
      if (pendientes.size >= MAX_PENDIENTES) return;
      pendientes.set(huella, { ...reg, huella, veces: 1 });
    }
    programar();
  } catch (e) {
    consolaOriginal('[erroresApp] no se pudo registrar:', e && e.message);
  }
}

function programar() {
  if (timer || esTest()) return;
  timer = setTimeout(() => { timer = null; escribir(); }, INTERVALO_MS);
  if (timer.unref) timer.unref();
}

function detalleJson(detalle) {
  if (!detalle) return null;
  const json = JSON.stringify(detalle);
  return json.length <= 8000 ? json : JSON.stringify({ recortado: json.slice(0, 7900) });
}

async function guardarLote(lote) {
  const db = require('../config/db');
  for (const r of lote) {
    const fila = {
      huella: r.huella, origen: r.origen, mensaje: r.mensaje, stack: r.stack, contexto: r.contexto,
      url: r.url, metodo: r.metodo, usuario_id: r.usuario_id, usuario_nombre: r.usuario_nombre,
      rol: r.rol, navegador: r.navegador, detalle: detalleJson(r.detalle), veces: r.veces,
    };
    await db('errores_app')
      .insert(fila)
      .onConflict('huella')
      .merge({
        veces: db.raw('errores_app.veces + ?', [r.veces]),
        ultima_vez: db.fn.now(),
        mensaje: fila.mensaje,
        stack: db.raw('COALESCE(?, errores_app.stack)', [fila.stack]),
        url: fila.url,
        metodo: fila.metodo,
        usuario_id: fila.usuario_id,
        usuario_nombre: fila.usuario_nombre,
        rol: fila.rol,
        navegador: fila.navegador,
        detalle: fila.detalle,
      });
  }
}

async function escribir() {
  if (escribiendo || !pendientes.size) return;
  if (Date.now() < pausadoHasta) { programar(); return; }
  escribiendo = true;
  const lote = [...pendientes.values()];
  pendientes = new Map();
  try {
    await guardarLote(lote);
  } catch (e) {
    // Sin base (o sin la tabla todavía): se descarta el lote y se reintenta en un minuto.
    pausadoHasta = Date.now() + 60 * 1000;
    consolaOriginal('[erroresApp] no se pudieron guardar los errores:', e && e.message);
  } finally {
    escribiendo = false;
    if (pendientes.size) programar();
  }
}

// console.error(...) → registro. Arma mensaje y stack con lo que haya en
// los argumentos: un Error, un objeto con { message, stack } o texto.
function desdeConsola(args) {
  let error = null;
  let extra = null;
  const textos = [];
  for (const a of args) {
    if (a instanceof Error) { if (!error) error = a; } else if (a && typeof a === 'object') { extra = extra || a; } else if (a != null) textos.push(String(a));
  }
  const etiqueta = textos.filter((t) => t !== '[ERROR]').join(' ').trim();
  let mensaje = error ? (error.message || String(error)) : '';
  let stack = error ? error.stack : null;
  if (!error && extra) {
    mensaje = extra.err || extra.error || extra.message || '';
    stack = extra.stack || null;
  }
  if (!mensaje) mensaje = etiqueta;
  const contextoTxt = mensaje === etiqueta ? null : etiqueta.replace(/:$/, '') || null;
  if (!mensaje || String(mensaje).startsWith('[erroresApp]')) return;
  registrar({ origen: 'servidor', mensaje, stack, contexto: contextoTxt, detalle: error && error.sql ? { sql: recortar(error.sql, 1500) } : null });
}

let instalado = false;
function capturarConsola() {
  if (instalado || esTest()) return;
  instalado = true;
  console.error = function (...args) {
    consolaOriginal(...args);
    if (escribiendo) return; // lo que loguee la propia escritura no se vuelve a registrar
    try { desdeConsola(args); } catch (_e) { /* nunca romper el log */ }
  };
}

// Deja la request a mano para cualquier error que se loguee mientras se
// atiende. Guarda la request entera (no una copia del usuario) porque
// req.user lo completa requireAuth DESPUÉS de este middleware.
function middlewareContexto(req, res, next) {
  contexto.run({ req }, next);
}

function escribirAhora() {
  if (timer) { clearTimeout(timer); timer = null; }
  return escribir();
}

module.exports = {
  registrar,
  capturarConsola,
  middlewareContexto,
  escribirAhora,
  consolaOriginal,
  _internos: { normalizar, rutaSinIds, lugarDelStack, huellaDe, desdeConsola },
};
