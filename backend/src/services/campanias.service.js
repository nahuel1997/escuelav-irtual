// =============================================================================
// campanias.service.js — Campañas de mail programadas (publicidad).
//
// - El admin arma la campaña (asunto, título, texto, imagen, botón y,
//   opcional, una oferta de la app), elige a quién (segmento) y la programa
//   para una fecha y hora. La tarea programada "campanias" (cada minuto) la
//   pasa a un proceso en segundo plano que la manda de a tandas.
// - Cada destinatario tiene un token propio: pixel de apertura, link de
//   click (siempre redirige al botón de LA campaña, nunca a una URL que
//   venga en el pedido) y link de baja de publicidad.
// - Solo a quien acepta publicidad (users.acepta_publicidad) y con la
//   cuenta activa; nunca a cuentas de prueba del Tester.
// - Si la campaña tiene una oferta con fecha de fin, el mail muestra
//   cuánto falta ("¡Quedan 3 días!").
// =============================================================================
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/env');
const mailService = require('./mail.service');
const { escaparHtml } = require('../utils/template');
const { paraSql, aDate } = require('../utils/sqlFecha');
const { AppError } = require('../middlewares/error.middleware');

const ROLES = ['alumno', 'profesor'];

// --- Segmento ---
// { roles: ['alumno','profesor'], listaId?, cursoId?, sinCompras? }
function validarSegmento(s) {
  const seg = s && typeof s === 'object' ? s : {};
  const roles = Array.isArray(seg.roles) ? seg.roles.filter((r) => ROLES.includes(r)) : ['alumno'];
  if (!roles.length) throw new AppError('Elegí al menos un tipo de destinatario', 400);
  return {
    roles,
    listaId: seg.listaId ? Number(seg.listaId) : null,
    cursoId: seg.cursoId ? Number(seg.cursoId) : null,
    sinCompras: Boolean(seg.sinCompras),
  };
}

function destinatariosQuery(segmento) {
  const q = db('users as u')
    .whereIn('u.rol', segmento.roles)
    .where('u.activo', true)
    .where('u.bloqueado', false)
    .where('u.es_prueba', false)
    .where('u.acepta_publicidad', true);
  if (segmento.listaId) q.whereExists(function () { this.select('*').from('mailing_list_members as m').whereRaw('m.user_id = u.id').where('m.mailing_list_id', segmento.listaId); });
  if (segmento.cursoId) q.whereExists(function () { this.select('*').from('enrollments as e').whereRaw('e.user_id = u.id').where('e.course_id', segmento.cursoId); });
  if (segmento.sinCompras) q.whereNotExists(function () { this.select('*').from('enrollments as e').whereRaw('e.user_id = u.id'); });
  return q;
}

async function contarDestinatarios(segmento) {
  const r = await destinatariosQuery(validarSegmento(segmento)).count({ c: '*' }).first();
  return Number(r.c);
}

// --- Contenido del mail ---

function faltaTexto(terminaEn) {
  const ms = aDate(terminaEn).getTime() - Date.now();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3600000);
  if (horas < 1) return '¡Termina en menos de una hora!';
  if (horas < 48) return `¡Quedan ${horas} horas!`;
  return `¡Quedan ${Math.floor(horas / 24)} días!`;
}

function urlAbsoluta(url) {
  if (!url) return null;
  if (url.startsWith('/uploads/')) return `${env.BACKEND_URL}${url}`;
  if (url.startsWith('/')) return `${env.FRONTEND_URL}${url}`;
  return url;
}

async function armarHtml(c, { token, nombre }) {
  const encabezado = await mailService.encabezadoMail();
  const oferta = c.oferta_id ? await db('ofertas').where({ id: c.oferta_id }).first() : null;
  const falta = oferta ? faltaTexto(oferta.termina_en) : null;
  const parrafos = String(c.contenido).split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => `<p style="margin:0 0 12px;">${escaparHtml(l)}</p>`).join('');
  const base = `${env.BACKEND_URL}/api/m`;
  const destino = c.boton_url || (oferta && oferta.boton_url);
  const boton = c.boton_texto && destino
    ? `<p style="margin:20px 0;"><a href="${token ? `${base}/c/${token}` : escaparHtml(urlAbsoluta(destino))}" style="display:inline-block; background:#e0972d; color:#1a1f26; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:bold;">${escaparHtml(c.boton_texto)}</a></p>`
    : '';
  const imagen = c.imagen_url ? `<img src="${escaparHtml(urlAbsoluta(c.imagen_url))}" alt="" style="width:100%; max-width:544px; border-radius:8px; margin:0 0 16px; display:block;">` : '';
  const contador = falta ? `<p style="margin:0 0 16px; font-size:18px; font-weight:bold; color:#b3261e;">${escaparHtml(falta)}</p>` : '';
  const saludo = nombre ? `<p style="margin:0 0 12px;">Hola ${escaparHtml(nombre)},</p>` : '';
  const pie = token
    ? `<p style="margin:24px 0 0; font-size:12px; color:#5b6470;">Recibiste este mail porque tenés una cuenta en Escuela Online. <a href="${env.FRONTEND_URL}/baja-publicidad/${token}" style="color:#5b6470;">No quiero recibir más publicidad</a>.</p><img src="${base}/a/${token}.gif" width="1" height="1" alt="" style="display:block;">`
    : '<p style="margin:24px 0 0; font-size:12px; color:#5b6470;">(Envío de prueba)</p>';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escaparHtml(c.asunto)}</title></head>
<body style="margin:0; padding:0; background:#f5f7fa; font-family:Arial, Helvetica, sans-serif; color:#1a1f26;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa; padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border:1px solid #e3e7ed; border-radius:10px; overflow:hidden;">
<tr><td>${encabezado}</td></tr>
<tr><td style="padding:24px 28px; font-size:15px; line-height:1.55;">
<h1 style="margin:0 0 16px; font-size:22px; color:#1c3d5a;">${escaparHtml(c.titulo)}</h1>
${imagen}${contador}${saludo}${parrafos}${boton}${pie}
</td></tr></table></td></tr></table></body></html>`;
}

// --- ABM ---

function validar(b) {
  const nombre = String(b.nombre || '').trim();
  const asunto = String(b.asunto || '').trim();
  const titulo = String(b.titulo || '').trim();
  const contenido = String(b.contenido || '').trim();
  if (!nombre || !asunto || !titulo || !contenido) throw new AppError('Completá nombre, asunto, título y texto', 400);
  const botonUrl = String(b.boton_url || '').trim();
  if (botonUrl && !/^(\/[^/\\]|https:\/\/)/.test(botonUrl)) throw new AppError('El link del botón tiene que ser una ruta del sitio (/tienda/…) o https://', 400);
  const imagen = String(b.imagen_url || '').trim();
  if (imagen && !/^(\/uploads\/|https:\/\/)/.test(imagen)) throw new AppError('La imagen tiene que ser una subida o https://', 400);
  return {
    nombre: nombre.slice(0, 120),
    asunto: asunto.slice(0, 200),
    titulo: titulo.slice(0, 200),
    contenido: contenido.slice(0, 10000),
    imagen_url: imagen || null,
    boton_texto: String(b.boton_texto || '').trim().slice(0, 60) || null,
    boton_url: botonUrl || null,
    oferta_id: b.oferta_id ? Number(b.oferta_id) : null,
    segmento: JSON.stringify(validarSegmento(b.segmento)),
  };
}

function conSegmento(c) {
  if (!c) return c;
  let segmento = {};
  try { segmento = JSON.parse(c.segmento); } catch (_e) { segmento = {}; }
  return { ...c, segmento };
}

async function obtener(id) {
  const c = await db('campanias').where({ id }).first();
  if (!c) throw new AppError('Campaña no encontrada', 404);
  return conSegmento(c);
}

async function listar() {
  const filas = await db('campanias').orderBy('id', 'desc').limit(200);
  const stats = await db('campania_envios').select('campania_id')
    .count({ enviados: '*' })
    .select(db.raw('sum(case when abierto_en is not null then 1 else 0 end) as abiertos'))
    .select(db.raw('sum(case when click_en is not null then 1 else 0 end) as con_click'))
    .select(db.raw('sum(case when baja_en is not null then 1 else 0 end) as bajas'))
    .where('estado', 'enviado')
    .groupBy('campania_id');
  const mapa = Object.fromEntries(stats.map((s) => [s.campania_id, s]));
  return filas.map((c) => {
    const s = mapa[c.id] || {};
    return { ...conSegmento(c), estadisticas: { enviados: Number(s.enviados || 0), abiertos: Number(s.abiertos || 0), conClick: Number(s.con_click || 0), bajas: Number(s.bajas || 0) } };
  });
}

async function crear(b, adminId) {
  const r = await db('campanias').insert({ ...validar(b), creada_por: adminId });
  return typeof r[0] === 'object' ? r[0].id : r[0];
}

async function editar(id, b) {
  const c = await obtener(id);
  if (!['borrador', 'programada', 'cancelada'].includes(c.estado)) throw new AppError('Una campaña que ya se está mandando o se mandó no se puede editar (duplicala)', 409);
  await db('campanias').where({ id }).update({ ...validar(b), updated_at: db.fn.now() });
}

async function borrar(id) {
  const c = await obtener(id);
  if (c.estado === 'enviando') throw new AppError('No se puede borrar una campaña que se está mandando', 409);
  await db('campanias').where({ id }).del();
}

async function programar(id, cuando) {
  const c = await obtener(id);
  if (!['borrador', 'programada', 'cancelada'].includes(c.estado)) throw new AppError('Esta campaña ya se mandó', 409);
  const fecha = new Date(cuando);
  if (Number.isNaN(fecha.getTime())) throw new AppError('Fecha de envío inválida', 400);
  if (fecha.getTime() < Date.now() - 60000) throw new AppError('La fecha de envío ya pasó (usá "Enviar ahora")', 400);
  if ((await contarDestinatarios(c.segmento)) === 0) throw new AppError('Con ese segmento no hay destinatarios', 400);
  await db('campanias').where({ id }).update({ estado: 'programada', programada_para: paraSql(fecha), updated_at: db.fn.now() });
}

async function cancelar(id) {
  const c = await obtener(id);
  if (c.estado !== 'programada') throw new AppError('Solo se puede cancelar una campaña programada que todavía no salió', 409);
  await db('campanias').where({ id }).update({ estado: 'cancelada', updated_at: db.fn.now() });
}

async function duplicar(id, adminId) {
  const c = await obtener(id);
  const r = await db('campanias').insert({
    nombre: `${c.nombre} (copia)`.slice(0, 120), asunto: c.asunto, titulo: c.titulo, contenido: c.contenido, imagen_url: c.imagen_url,
    boton_texto: c.boton_texto, boton_url: c.boton_url, oferta_id: c.oferta_id, segmento: JSON.stringify(c.segmento), creada_por: adminId,
  });
  return typeof r[0] === 'object' ? r[0].id : r[0];
}

async function enviarPrueba(id, destinatario, admin) {
  const c = await obtener(id);
  const email = String(destinatario || admin.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new AppError('Mail de prueba inválido', 400);
  const r = await mailService.enviarRenderizado({ destinatario: email, asunto: `[PRUEBA] ${c.asunto}`, cuerpo: await armarHtml(c, { token: null, nombre: admin.nombre }), tipo: 'campania_prueba', userId: admin.id });
  if (!r.ok) throw new AppError('No se pudo mandar la prueba (revisá Errores de mails)', 502);
  return email;
}

async function vistaPrevia(id) {
  return armarHtml(await obtener(id), { token: null, nombre: 'Nombre' });
}

// Marca como "enviando" y encola el proceso. Lo usan "Enviar ahora" y la
// tarea programada. El UPDATE condicional evita mandarla dos veces si dos
// procesos del servidor la ven vencida al mismo tiempo.
async function lanzar(id, user) {
  const n = await db('campanias').where({ id }).whereIn('estado', ['borrador', 'programada', 'cancelada']).update({ estado: 'enviando', updated_at: db.fn.now() });
  if (!n) throw new AppError('Esta campaña ya se está mandando o ya se mandó', 409);
  const procesos = require('./procesos');
  const p = await procesos.encolar({ tipo: 'campania_envio', parametros: { campaniaId: Number(id) }, user });
  await db('campanias').where({ id }).update({ proceso_id: p.id });
  return p;
}

// Tarea programada (cada minuto): lanza las campañas cuya hora ya llegó.
async function enviarCampaniasVencidas() {
  const vencidas = await db('campanias').where({ estado: 'programada' }).where('programada_para', '<=', paraSql(new Date())).select('id', 'creada_por');
  let lanzadas = 0;
  for (const c of vencidas) {
    const admin = c.creada_por ? await db('users').where({ id: c.creada_por }).first() : null;
    const user = admin || { id: null, rol: 'admin' };
    try {
      await lanzar(c.id, { ...user, rol: 'admin' });
      lanzadas += 1;
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
    }
  }
  return lanzadas;
}

// Ejecución del envío (dentro del proceso en segundo plano).
async function ejecutarEnvio(campaniaId, progreso) {
  const c = await obtener(campaniaId);
  const destinatarios = await destinatariosQuery(c.segmento).select('u.id', 'u.email', 'u.nombre');
  for (const d of destinatarios) {
    const existe = await db('campania_envios').where({ campania_id: c.id, user_id: d.id }).first();
    if (!existe) await db('campania_envios').insert({ campania_id: c.id, user_id: d.id, email: d.email, token: crypto.randomBytes(24).toString('base64url') });
  }
  await db('campanias').where({ id: c.id }).update({ total_destinatarios: destinatarios.length });

  const pendientes = await db('campania_envios as e').join('users as u', 'u.id', 'e.user_id')
    .where('e.campania_id', c.id).where('e.estado', 'pendiente').select('e.*', 'u.nombre');
  let enviados = 0;
  let fallidos = 0;
  for (let i = 0; i < pendientes.length; i += 1) {
    const e = pendientes[i];
    const r = await mailService.enviarRenderizado({
      destinatario: e.email,
      asunto: c.asunto,
      cuerpo: await armarHtml(c, { token: e.token, nombre: e.nombre }),
      tipo: 'campania',
      userId: e.user_id,
      headers: { 'List-Unsubscribe': `<${env.FRONTEND_URL}/baja-publicidad/${e.token}>` },
    });
    if (r.ok) {
      enviados += 1;
      await db('campania_envios').where({ id: e.id }).update({ estado: 'enviado', enviado_en: db.fn.now() });
    } else {
      fallidos += 1;
      await db('campania_envios').where({ id: e.id }).update({ estado: 'fallido', error: String(r.error || r.motivo || '').slice(0, 300) });
    }
    if (i % 10 === 0) await progreso(Math.round(((i + 1) / pendientes.length) * 100));
  }
  const totalEnviados = Number((await db('campania_envios').where({ campania_id: c.id, estado: 'enviado' }).count({ c: '*' }).first()).c);
  const totalFallidos = Number((await db('campania_envios').where({ campania_id: c.id, estado: 'fallido' }).count({ c: '*' }).first()).c);
  await db('campanias').where({ id: c.id }).update({
    estado: totalEnviados === 0 && totalFallidos > 0 ? 'error' : 'enviada',
    enviados: totalEnviados,
    fallidos: totalFallidos,
    enviada_en: db.fn.now(),
    updated_at: db.fn.now(),
  });
  return { enviados, fallidos, destinatarios: destinatarios.length };
}

// --- Seguimiento público (sin login; el token es la credencial) ---

async function registrarApertura(token) {
  await db('campania_envios').where({ token }).whereNull('abierto_en').update({ abierto_en: db.fn.now() });
}

// Devuelve la URL a la que redirigir: SIEMPRE el botón configurado en la
// campaña (o su oferta), nunca algo que venga en el pedido.
async function registrarClick(token) {
  const e = await db('campania_envios').where({ token }).first();
  if (!e) return `${env.FRONTEND_URL}/`;
  await db('campania_envios').where({ id: e.id }).update({ clicks: (e.clicks || 0) + 1, click_en: e.click_en || db.fn.now(), abierto_en: e.abierto_en || db.fn.now() });
  const c = await db('campanias').where({ id: e.campania_id }).first();
  const oferta = c && c.oferta_id ? await db('ofertas').where({ id: c.oferta_id }).first() : null;
  return urlAbsoluta((c && c.boton_url) || (oferta && oferta.boton_url) || '/') || `${env.FRONTEND_URL}/`;
}

async function infoBaja(token) {
  const e = await db('campania_envios as e').join('users as u', 'u.id', 'e.user_id').where('e.token', token).select('e.email', 'u.acepta_publicidad').first();
  if (!e) throw new AppError('El link no es válido', 404);
  const [usuario, dominio] = e.email.split('@');
  return { email: `${usuario.slice(0, 2)}***@${dominio}`, yaDadoDeBaja: !e.acepta_publicidad };
}

async function darDeBaja(token) {
  const e = await db('campania_envios').where({ token }).first();
  if (!e) throw new AppError('El link no es válido', 404);
  await db('users').where({ id: e.user_id }).update({ acepta_publicidad: false, baja_publicidad_en: db.fn.now() });
  await db('campania_envios').where({ id: e.id }).whereNull('baja_en').update({ baja_en: db.fn.now() });
}

async function estadisticas(id) {
  const c = await obtener(id);
  const envios = await db('campania_envios').where({ campania_id: c.id }).select('estado', 'abierto_en', 'click_en', 'clicks', 'baja_en', 'enviado_en');
  const enviados = envios.filter((e) => e.estado === 'enviado');
  const abiertos = enviados.filter((e) => e.abierto_en).length;
  const conClick = enviados.filter((e) => e.click_en).length;
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  return {
    campania: c,
    total: envios.length,
    enviados: enviados.length,
    fallidos: envios.filter((e) => e.estado === 'fallido').length,
    pendientes: envios.filter((e) => e.estado === 'pendiente').length,
    abiertos,
    conClick,
    clicks: enviados.reduce((s, e) => s + (e.clicks || 0), 0),
    bajas: envios.filter((e) => e.baja_en).length,
    tasaApertura: pct(abiertos, enviados.length),
    tasaClick: pct(conClick, enviados.length),
  };
}

module.exports = {
  validarSegmento,
  contarDestinatarios,
  listar,
  obtener,
  crear,
  editar,
  borrar,
  programar,
  cancelar,
  duplicar,
  enviarPrueba,
  vistaPrevia,
  lanzar,
  enviarCampaniasVencidas,
  ejecutarEnvio,
  registrarApertura,
  registrarClick,
  infoBaja,
  darDeBaja,
  estadisticas,
};
