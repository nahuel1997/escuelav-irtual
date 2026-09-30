// =============================================================================
// metricas.service.js — Estado de la app (portado de estadoApp /
// requestStats / latenciaMonitor / eventLoopMonitor de DBA24).
//
// - En memoria: requests por minuto de la última hora, latencia, 5xx y las
//   rutas más lentas; demora del event loop (perf_hooks).
// - Cada hora se guarda una foto en metricas_app (serie de 30+ días para el
//   análisis mensual del panel).
// - Test de velocidad a pedido: base, bcrypt, PDF y disco.
// =============================================================================
const os = require('os');
const fs = require('fs');
const path = require('path');
const { monitorEventLoopDelay, performance } = require('perf_hooks');
const bcrypt = require('bcryptjs');
const presencia = require('./presencia.service');

const MINUTOS = 60;
let buckets = []; // [{ minuto, requests, latenciaTotal, errores5xx }]
const rutas = new Map(); // "GET /api/courses/:id" -> { n, total, max }
const inicioProceso = Date.now();

const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();

function minutoActual() {
  return Math.floor(Date.now() / 60000);
}

function bucket() {
  const m = minutoActual();
  let b = buckets[buckets.length - 1];
  if (!b || b.minuto !== m) {
    b = { minuto: m, requests: 0, latenciaTotal: 0, errores5xx: 0 };
    buckets.push(b);
    buckets = buckets.filter((x) => x.minuto > m - MINUTOS);
  }
  return b;
}

function rutaNormalizada(req) {
  const base = String(req.originalUrl || '').split('?')[0]
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f-]{20,}(?=\/|$)/gi, '/:id')
    .replace(/\/[A-Za-z0-9_-]{32,}(?=\/|$)/g, '/:token');
  return `${req.method} ${base}`;
}

// Middleware: mide cada request de la API.
function middleware(req, res, next) {
  const inicio = performance.now();
  res.on('finish', () => {
    try {
      const ms = performance.now() - inicio;
      const b = bucket();
      b.requests += 1;
      b.latenciaTotal += ms;
      if (res.statusCode >= 500) b.errores5xx += 1;
      if (req.originalUrl.startsWith('/api/')) {
        const k = rutaNormalizada(req);
        const r = rutas.get(k) || { n: 0, total: 0, max: 0 };
        r.n += 1;
        r.total += ms;
        r.max = Math.max(r.max, ms);
        rutas.set(k, r);
        if (rutas.size > 500) rutas.delete(rutas.keys().next().value);
      }
    } catch (_e) {
      // medir nunca rompe una request
    }
  });
  next();
}

function resumenUltimaHora() {
  bucket();
  const requests = buckets.reduce((s, b) => s + b.requests, 0);
  const latencia = buckets.reduce((s, b) => s + b.latenciaTotal, 0);
  return {
    requests,
    latenciaPromMs: requests ? Math.round((latencia / requests) * 10) / 10 : 0,
    errores5xx: buckets.reduce((s, b) => s + b.errores5xx, 0),
    porMinuto: buckets.map((b) => ({ minuto: new Date(b.minuto * 60000).toISOString(), requests: b.requests, latenciaPromMs: b.requests ? Math.round(b.latenciaTotal / b.requests) : 0 })),
  };
}

function rutasMasLentas(n = 10) {
  return [...rutas.entries()]
    .map(([ruta, r]) => ({ ruta, requests: r.n, promMs: Math.round(r.total / r.n), maxMs: Math.round(r.max) }))
    .sort((a, b) => b.promMs - a.promMs)
    .slice(0, n);
}

function eventLoop() {
  return {
    promMs: Math.round((loop.mean / 1e6) * 10) / 10 || 0,
    p99Ms: Math.round((loop.percentile(99) / 1e6) * 10) / 10 || 0,
    maxMs: Math.round((loop.max / 1e6) * 10) / 10 || 0,
  };
}

let cpuPrevio = process.cpuUsage();
let cpuPrevioEn = Date.now();
function cargaCpu() {
  const ahora = Date.now();
  const uso = process.cpuUsage(cpuPrevio);
  const transcurridoMs = Math.max(1, ahora - cpuPrevioEn);
  cpuPrevio = process.cpuUsage();
  cpuPrevioEn = ahora;
  // % de UN núcleo que usó este proceso desde la última medición.
  return Math.round(((uso.user + uso.system) / 1000 / transcurridoMs) * 1000) / 10;
}

async function tamanoCarpeta(dir, limite = 20000) {
  let total = 0;
  let archivos = 0;
  async function recorrer(d) {
    let entradas = [];
    try { entradas = await fs.promises.readdir(d, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of entradas) {
      if (archivos > limite) return;
      const ruta = path.join(d, e.name);
      if (e.isDirectory()) await recorrer(ruta);
      else {
        archivos += 1;
        try { total += (await fs.promises.stat(ruta)).size; } catch (_e) { /* se borró */ }
      }
    }
  }
  await recorrer(dir);
  return { mb: Math.round((total / 1048576) * 10) / 10, archivos };
}

async function latenciaBase() {
  const db = require('../config/db');
  const t = performance.now();
  await db.raw('select 1');
  return Math.round((performance.now() - t) * 10) / 10;
}

async function snapshot() {
  const db = require('../config/db');
  const mem = process.memoryUsage();
  const raiz = path.join(__dirname, '..', '..');
  const [dbMs, carpetaData, carpetaUploads, carpetaPrivado, usuarios, procesosPend] = await Promise.all([
    latenciaBase().catch(() => null),
    tamanoCarpeta(path.join(raiz, 'data')),
    tamanoCarpeta(path.join(raiz, 'uploads')),
    tamanoCarpeta(path.join(raiz, 'privado')),
    db('users').count({ c: '*' }).first().then((r) => Number(r.c)).catch(() => null),
    db('procesos').whereIn('estado', ['pendiente', 'en_curso']).count({ c: '*' }).first().then((r) => Number(r.c)).catch(() => null),
  ]);
  const errores24h = await require('../models/errorApp.model').contarUltimas24h().catch(() => null);
  return {
    servidor: {
      node: process.version,
      plataforma: `${os.type()} ${os.release()} (${os.arch()})`,
      nucleos: os.cpus().length,
      memoriaTotalMb: Math.round(os.totalmem() / 1048576),
      memoriaLibreMb: Math.round(os.freemem() / 1048576),
      cargaSistema: os.loadavg().map((x) => Math.round(x * 100) / 100),
      uptimeProcesoMin: Math.round((Date.now() - inicioProceso) / 60000),
      baseDeDatos: db.client.config.client,
    },
    proceso: {
      rssMb: Math.round(mem.rss / 1048576),
      heapUsadoMb: Math.round(mem.heapUsed / 1048576),
      heapTotalMb: Math.round(mem.heapTotal / 1048576),
      cpuPorcentaje: cargaCpu(),
    },
    eventLoop: eventLoop(),
    ultimaHora: resumenUltimaHora(),
    rutasMasLentas: rutasMasLentas(),
    baseLatenciaMs: dbMs,
    disco: { data: carpetaData, uploads: carpetaUploads, privado: carpetaPrivado },
    app: { usuarios, usuariosOnline: presencia.online().length, errores24h, procesosPendientes: procesosPend },
  };
}

// Foto horaria (la llama el job "metricas_horarias").
async function registrarMetrica() {
  const db = require('../config/db');
  const h = resumenUltimaHora();
  const mem = process.memoryUsage();
  await db('metricas_app').insert({
    rss_mb: Math.round(mem.rss / 1048576),
    heap_mb: Math.round(mem.heapUsed / 1048576),
    carga_cpu: cargaCpu(),
    lag_p99_ms: eventLoop().p99Ms,
    requests: h.requests,
    latencia_prom_ms: h.latenciaPromMs,
    errores_5xx: h.errores5xx,
    usuarios_online: presencia.online().length,
  });
  loop.reset();
  return 1;
}

function serie(dias = 30) {
  const db = require('../config/db');
  return db('metricas_app').where('ts', '>=', require('../utils/sqlFecha').haceDias(dias)).orderBy('ts', 'asc').limit(24 * 62);
}

// Test de velocidad: cada paso medido por separado.
async function testVelocidad() {
  const db = require('../config/db');
  const { generarPdf } = require('../utils/pdfReporte');
  const storage = require('./storage.service');
  const medir = async (nombre, fn) => {
    const t = performance.now();
    try {
      await fn();
      return { nombre, ms: Math.round((performance.now() - t) * 10) / 10, ok: true };
    } catch (e) {
      return { nombre, ms: Math.round(performance.now() - t), ok: false, error: e.message };
    }
  };
  const pasos = [];
  pasos.push(await medir('Consulta simple a la base (select 1)', () => db.raw('select 1')));
  pasos.push(await medir('Consulta real (contar usuarios)', () => db('users').count({ c: '*' })));
  pasos.push(await medir('Hash de contraseña (bcrypt, costo 10)', () => bcrypt.hash('prueba-de-velocidad', 10)));
  pasos.push(await medir('Generar un PDF de 2 páginas', () => generarPdf({
    titulo: 'Test de velocidad',
    bloques: [{ tipo: 'tabla', columnas: [{ titulo: 'A' }, { titulo: 'B' }], filas: Array.from({ length: 80 }, (_, i) => [i, `fila ${i}`]) }],
  })));
  pasos.push(await medir('Escribir y leer 1 MB en disco', async () => {
    const ruta = path.join(storage.carpetaPrivada('tmp'), `velocidad-${Date.now()}.bin`);
    await fs.promises.writeFile(ruta, Buffer.alloc(1048576, 7));
    await fs.promises.readFile(ruta);
    await fs.promises.unlink(ruta);
  }));
  return { pasos, totalMs: Math.round(pasos.reduce((s, p) => s + p.ms, 0) * 10) / 10, ts: new Date().toISOString() };
}

module.exports = { middleware, snapshot, registrarMetrica, serie, testVelocidad, resumenUltimaHora };
