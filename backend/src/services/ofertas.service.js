// =============================================================================
// ofertas.service.js — Ofertas en la app: barra, banner o pop-up con cuenta
// regresiva hasta que termina la oferta, para un público (todos, visitantes
// sin sesión, alumnos o profesores). Si la oferta está asociada a un curso
// con descuento, el descuento se aplica DE VERDAD en la tienda, en la
// compra directa y en el carrito, mientras la oferta esté vigente — nunca
// se confía en un precio que mande el navegador.
// =============================================================================
const db = require('../config/db');
const { paraSql, aDate } = require('../utils/sqlFecha');
const { AppError } = require('../middlewares/error.middleware');

const TIPOS = ['barra', 'banner', 'popup'];
const AUDIENCIAS = ['todos', 'visitantes', 'alumnos', 'profesores'];
const COLOR = /^#[0-9a-f]{6}$/i;

function normalizar(o) {
  if (!o) return o;
  // Fechas siempre en ISO con zona (SQLite las devuelve sin zona, en UTC):
  // si no, el navegador las leería como hora local y el contador daría mal.
  return {
    ...o,
    inicia_en: aDate(o.inicia_en).toISOString(),
    termina_en: aDate(o.termina_en).toISOString(),
    mostrar_contador: Boolean(o.mostrar_contador),
    activa: Boolean(o.activa),
  };
}

function vigentesQuery() {
  const ahora = paraSql(new Date());
  return db('ofertas').where({ activa: true }).where('inicia_en', '<=', ahora).where('termina_en', '>', ahora);
}

function audienciaDe(user) {
  if (!user) return 'visitantes';
  if (user.rol === 'alumno') return 'alumnos';
  if (user.rol === 'profesor') return 'profesores';
  return null; // admin / soporte no ven ofertas en la app
}

// Ofertas para mostrar ahora a este usuario (o visitante).
async function activasPara(user) {
  const aud = audienciaDe(user);
  if (!aud) return [];
  const filas = await vigentesQuery().whereIn('audiencia', ['todos', aud]).orderBy('prioridad', 'desc').orderBy('termina_en', 'asc');
  const cursos = filas.filter((o) => o.curso_id).map((o) => o.curso_id);
  const titulos = cursos.length ? Object.fromEntries((await db('courses').whereIn('id', cursos).select('id', 'titulo', 'precio')).map((c) => [c.id, c])) : {};
  return filas.map((o) => {
    const curso = o.curso_id ? titulos[o.curso_id] : null;
    const precio = curso ? Number(curso.precio) : null;
    return {
      ...normalizar(o),
      curso: curso ? { id: curso.id, titulo: curso.titulo, precio, precioOferta: o.descuento_pct ? precioConDescuento(precio, o.descuento_pct) : precio } : null,
    };
  });
}

function precioConDescuento(precio, pct) {
  return Math.round(Number(precio) * (100 - Number(pct))) / 100;
}

// Mejor descuento vigente por curso (para todos los que compran: la tienda
// es la misma para visitantes y alumnos).
async function descuentosVigentes(cursoIds) {
  if (!cursoIds.length) return {};
  const filas = await vigentesQuery().whereIn('curso_id', cursoIds).whereNotNull('descuento_pct')
    .whereIn('audiencia', ['todos', 'visitantes', 'alumnos']).select('id', 'curso_id', 'descuento_pct', 'termina_en');
  const mejor = {};
  filas.forEach((f) => {
    if (!mejor[f.curso_id] || f.descuento_pct > mejor[f.curso_id].descuento_pct) mejor[f.curso_id] = f;
  });
  return mejor;
}

// Devuelve los cursos con el precio que corresponde cobrar HOY. El precio
// de lista queda en precio_original.
async function aplicarPrecios(cursos) {
  const lista = (cursos || []).filter(Boolean);
  const desc = await descuentosVigentes([...new Set(lista.map((c) => c.id).filter(Boolean))]);
  return lista.map((c) => {
    const d = desc[c.id];
    if (!d) return c;
    return {
      ...c,
      precio_original: Number(c.precio),
      precio: precioConDescuento(c.precio, d.descuento_pct),
      descuento_pct: d.descuento_pct,
      oferta_id: d.id,
      oferta_termina_en: aDate(d.termina_en).toISOString(),
    };
  });
}

function fecha(v, campo) {
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime())) throw new AppError(`Fecha de ${campo} inválida`, 400);
  return d;
}

async function validar(b) {
  const titulo = String(b.titulo || '').trim();
  if (!titulo) throw new AppError('Poné un título', 400);
  if (!TIPOS.includes(b.tipo)) throw new AppError('Tipo inválido (barra, banner o popup)', 400);
  if (!AUDIENCIAS.includes(b.audiencia || 'todos')) throw new AppError('Público inválido', 400);
  const inicia = fecha(b.inicia_en, 'inicio');
  const termina = fecha(b.termina_en, 'fin');
  if (termina <= inicia) throw new AppError('La oferta tiene que terminar después de empezar', 400);
  const botonUrl = String(b.boton_url || '').trim();
  if (botonUrl && !/^(\/[^/\\]|https:\/\/)/.test(botonUrl)) throw new AppError('El link del botón tiene que ser una ruta del sitio (/tienda/…) o https://', 400);
  const imagen = String(b.imagen_url || '').trim();
  if (imagen && !/^(\/uploads\/|https:\/\/)/.test(imagen)) throw new AppError('La imagen tiene que ser una subida o https://', 400);
  let cursoId = b.curso_id ? Number(b.curso_id) : null;
  let descuento = b.descuento_pct === '' || b.descuento_pct == null ? null : Number(b.descuento_pct);
  if (cursoId && !(await db('courses').where({ id: cursoId }).first())) throw new AppError('El curso no existe', 400);
  if (descuento !== null) {
    if (!cursoId) throw new AppError('Para aplicar un descuento elegí el curso', 400);
    if (!Number.isInteger(descuento) || descuento < 1 || descuento > 90) throw new AppError('El descuento va del 1 al 90 %', 400);
  }
  if (!cursoId) descuento = null;
  return {
    titulo: titulo.slice(0, 120),
    mensaje: String(b.mensaje || '').trim().slice(0, 500) || null,
    tipo: b.tipo,
    imagen_url: imagen || null,
    color_fondo: COLOR.test(b.color_fondo || '') ? b.color_fondo : '#e0972d',
    color_texto: COLOR.test(b.color_texto || '') ? b.color_texto : '#1a1f26',
    boton_texto: String(b.boton_texto || '').trim().slice(0, 60) || null,
    boton_url: botonUrl || (cursoId ? `/tienda/${cursoId}` : null),
    curso_id: cursoId,
    descuento_pct: descuento,
    audiencia: b.audiencia || 'todos',
    inicia_en: paraSql(inicia),
    termina_en: paraSql(termina),
    mostrar_contador: b.mostrar_contador !== false,
    activa: b.activa !== false,
    prioridad: Number.isInteger(Number(b.prioridad)) ? Number(b.prioridad) : 0,
  };
}

async function listar() {
  const filas = await db('ofertas as o').leftJoin('courses as c', 'c.id', 'o.curso_id').select('o.*', 'c.titulo as curso_titulo').orderBy('o.id', 'desc');
  const eventos = await db('oferta_eventos').select('oferta_id', 'tipo').count({ c: '*' }).groupBy('oferta_id', 'tipo');
  const stats = {};
  eventos.forEach((e) => { (stats[e.oferta_id] = stats[e.oferta_id] || {})[e.tipo] = Number(e.c); });
  return filas.map((o) => ({ ...normalizar(o), estadisticas: { vistas: 0, clicks: 0, cerradas: 0, ...Object.fromEntries(Object.entries(stats[o.id] || {}).map(([k, v]) => [{ vista: 'vistas', click: 'clicks', cerrada: 'cerradas' }[k], v])) } }));
}

async function crear(b, adminId) {
  const r = await db('ofertas').insert({ ...(await validar(b)), creada_por: adminId });
  return typeof r[0] === 'object' ? r[0].id : r[0];
}

async function editar(id, b) {
  if (!(await db('ofertas').where({ id }).first())) throw new AppError('Oferta no encontrada', 404);
  await db('ofertas').where({ id }).update({ ...(await validar(b)), updated_at: db.fn.now() });
}

function borrar(id) {
  return db('ofertas').where({ id }).del();
}

async function registrarEvento({ ofertaId, tipo, user, visitante }) {
  if (!['vista', 'click', 'cerrada'].includes(tipo)) throw new AppError('Evento inválido', 400);
  if (!(await db('ofertas').where({ id: ofertaId }).first())) throw new AppError('Oferta no encontrada', 404);
  await db('oferta_eventos').insert({
    oferta_id: ofertaId,
    tipo,
    user_id: user ? user.id : null,
    visitante: /^[A-Za-z0-9-]{8,64}$/.test(String(visitante || '')) ? visitante : null,
  });
}

module.exports = { TIPOS, AUDIENCIAS, activasPara, aplicarPrecios, precioConDescuento, listar, crear, editar, borrar, registrarEvento };
