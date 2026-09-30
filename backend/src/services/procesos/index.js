// =============================================================================
// Procesos en segundo plano (portado de services/procesos de DBA24).
//
// Todo lo largo (PDFs, envíos de mail, campañas, importaciones) se encola
// con un número de seguimiento P-000123 y lo ejecuta un trabajador dentro
// del mismo servidor. El pedido HTTP vuelve al instante; el frontend
// muestra una capa gris sobre la sección y consulta el estado hasta que
// termina (ver frontend/src/hooks/useProceso.js).
//
// Tomar un proceso es un UPDATE condicional (… WHERE estado='pendiente'):
// si dos trabajadores (dos procesos de PM2) quieren el mismo, solo uno
// cambia la fila — el otro ve 0 filas afectadas y sigue de largo.
//
// Tipo nuevo = un archivo en ./tipos/ que exporta:
//   { roles, titulo(params), validar(params, user) -> params,
//     ejecutar({ params, user, progreso }) -> { resultado?, archivo? } }
// donde archivo = { buffer, nombre, mime }.
// =============================================================================
const fs = require('fs');
const path = require('path');
const db = require('../../config/db');
const storage = require('../storage.service');
const { AppError } = require('../../middlewares/error.middleware');

const INTERVALO_MS = 2000;
const MAX_INTENTOS = 3;
const CONCURRENCIA = 2;

const TIPOS = {};
fs.readdirSync(path.join(__dirname, 'tipos'))
  .filter((f) => f.endsWith('.js'))
  .forEach((f) => { TIPOS[path.basename(f, '.js')] = require(`./tipos/${f}`); });

function numero(id) {
  return `P-${String(id).padStart(6, '0')}`;
}

function publico(p) {
  if (!p) return p;
  let resultado = null;
  try { resultado = p.resultado ? JSON.parse(p.resultado) : null; } catch (_e) { resultado = null; }
  return {
    id: p.id,
    numero: numero(p.id),
    tipo: p.tipo,
    titulo: p.titulo,
    estado: p.estado,
    progreso: p.progreso,
    error: p.error,
    resultado,
    tieneArchivo: Boolean(p.archivo),
    archivoNombre: p.archivo_nombre,
    userId: p.user_id,
    creado: p.created_at,
    iniciado: p.iniciado_en,
    terminado: p.terminado_en,
  };
}

async function encolar({ tipo, parametros = {}, user }) {
  const def = TIPOS[tipo];
  if (!def) throw new AppError('Tipo de proceso desconocido', 400);
  if (!def.roles.includes(user.rol)) throw new AppError('No podés iniciar este proceso', 403);
  const params = await def.validar(parametros || {}, user);
  const res = await db('procesos').insert({
    tipo,
    user_id: user.id,
    titulo: String(def.titulo(params, user)).slice(0, 250),
    parametros: JSON.stringify(params),
  });
  const id = typeof res[0] === 'object' ? res[0].id : res[0];
  despertar();
  return publico(await db('procesos').where({ id }).first());
}

async function obtener(id) {
  return db('procesos').where({ id }).first();
}

function listar({ userId, estado, tipo, limite = 100 } = {}) {
  const q = db('procesos as p').leftJoin('users as u', 'u.id', 'p.user_id')
    .select('p.*', 'u.nombre', 'u.apellido')
    .orderBy('p.id', 'desc')
    .limit(limite);
  if (userId) q.where('p.user_id', userId);
  if (estado) q.where('p.estado', estado);
  if (tipo) q.where('p.tipo', tipo);
  return q.then((filas) => filas.map((f) => ({ ...publico(f), usuario: f.nombre ? `${f.nombre} ${f.apellido}` : null })));
}

async function cancelar(id, user) {
  const p = await obtener(id);
  if (!p || (user.rol !== 'admin' && p.user_id !== user.id)) throw new AppError('Proceso no encontrado', 404);
  const n = await db('procesos').where({ id, estado: 'pendiente' }).update({ estado: 'cancelado', terminado_en: db.fn.now(), updated_at: db.fn.now() });
  if (!n) throw new AppError('Solo se puede cancelar un proceso que todavía no arrancó', 409);
}

async function reintentar(id) {
  const n = await db('procesos').where({ id }).whereIn('estado', ['error', 'cancelado'])
    .update({ estado: 'pendiente', error: null, progreso: 0, intentos: 0, updated_at: db.fn.now() });
  if (!n) throw new AppError('Solo se puede reintentar un proceso con error o cancelado', 409);
  despertar();
}

// --- Trabajador ---

let corriendo = 0;
let timer = null;
let activo = false;

async function tomarUno() {
  const candidato = await db('procesos').where({ estado: 'pendiente' }).orderBy('id', 'asc').first();
  if (!candidato) return null;
  const n = await db('procesos').where({ id: candidato.id, estado: 'pendiente' })
    .update({ estado: 'en_curso', iniciado_en: db.fn.now(), intentos: (candidato.intentos || 0) + 1, updated_at: db.fn.now() });
  return n === 1 ? candidato : tomarUno(); // otro trabajador lo tomó primero: probar el siguiente
}

async function ejecutarProceso(p) {
  const def = TIPOS[p.tipo];
  const progreso = (n) => db('procesos').where({ id: p.id }).update({ progreso: Math.max(0, Math.min(100, Math.round(n))) }).catch(() => {});
  try {
    if (!def) throw new Error(`Tipo de proceso desconocido: ${p.tipo}`);
    const user = p.user_id ? await db('users').where({ id: p.user_id }).first() : null;
    const params = p.parametros ? JSON.parse(p.parametros) : {};
    const salida = (await def.ejecutar({ params, user, progreso, procesoId: p.id })) || {};
    const patch = { estado: 'terminado', progreso: 100, terminado_en: db.fn.now(), updated_at: db.fn.now(), error: null };
    if (salida.resultado !== undefined) patch.resultado = JSON.stringify(salida.resultado);
    if (salida.archivo) {
      const nombreDisco = `${numero(p.id)}-${Date.now()}${path.extname(salida.archivo.nombre || '') || '.bin'}`;
      await fs.promises.writeFile(storage.rutaPrivada('procesos', nombreDisco), salida.archivo.buffer);
      patch.archivo = nombreDisco;
      patch.archivo_nombre = String(salida.archivo.nombre || nombreDisco).slice(0, 200);
      patch.archivo_mime = salida.archivo.mime || 'application/octet-stream';
    }
    await db('procesos').where({ id: p.id }).update(patch);
  } catch (err) {
    console.error(`[procesos] ${numero(p.id)} (${p.tipo}) falló:`, err);
    await db('procesos').where({ id: p.id }).update({
      estado: 'error',
      error: String(err.publicMessage || err.message || err).slice(0, 1000),
      terminado_en: db.fn.now(),
      updated_at: db.fn.now(),
    }).catch(() => {});
  }
}

async function ciclo() {
  timer = null;
  try {
    while (corriendo < CONCURRENCIA) {
      const p = await tomarUno();
      if (!p) break;
      corriendo += 1;
      ejecutarProceso(p).finally(() => { corriendo -= 1; despertar(); });
    }
  } catch (err) {
    console.error('[procesos] error del trabajador:', err.message);
  }
  if (activo && !timer) {
    timer = setTimeout(ciclo, INTERVALO_MS);
    if (timer.unref) timer.unref();
  }
}

function despertar() {
  if (!activo) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(ciclo, 50);
  if (timer.unref) timer.unref();
}

// Al arrancar: lo que quedó "en curso" de una caída anterior vuelve a la
// cola (hasta MAX_INTENTOS), o queda con error.
async function recuperarHuerfanos() {
  await db('procesos').where({ estado: 'en_curso' }).where('intentos', '<', MAX_INTENTOS).update({ estado: 'pendiente', updated_at: db.fn.now() });
  await db('procesos').where({ estado: 'en_curso' }).update({ estado: 'error', error: 'Se interrumpió varias veces (reinicio del servidor)', terminado_en: db.fn.now() });
}

async function iniciarTrabajador() {
  if (activo) return;
  activo = true;
  await recuperarHuerfanos().catch((e) => console.error('[procesos] no se pudieron recuperar procesos:', e.message));
  ciclo();
  console.log('[procesos] Trabajador de procesos en segundo plano iniciado');
}

function detenerTrabajador() {
  activo = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

// Para los tests: ejecuta ya todo lo pendiente, sin trabajador de fondo.
async function procesarPendientes() {
  for (;;) {
    const p = await tomarUno();
    if (!p) return;
    await ejecutarProceso(p);
  }
}

module.exports = {
  TIPOS,
  numero,
  publico,
  encolar,
  obtener,
  listar,
  cancelar,
  reintentar,
  iniciarTrabajador,
  detenerTrabajador,
  procesarPendientes,
};
