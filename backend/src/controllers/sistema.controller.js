// =============================================================================
// sistema.controller.js — Backups y Actualizaciones desde el panel
// (portado de backupsController / actualizacionesController de DBA24).
// Cada sección tiene su propia lista blanca (ver listaBlanca.middleware.js).
//
// Backups:
// - Base: SQLite → copia consistente con la API de backup de better-sqlite3;
//   Postgres → pg_dump (tiene que estar instalado en el servidor).
// - Proyecto: .tar.gz del código SIN .env, sin llaves, sin node_modules y
//   sin datos (data/, privado/, uploads/) — el .env se respalda aparte.
//
// Actualizaciones: git fetch + pull --ff-only + npm install + migraciones,
// con la salida en vivo. Los comandos son fijos (nunca sale nada del
// request), y el reinicio lo hace el process manager (PM2 si está).
// =============================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const env = require('../config/env');
const db = require('../config/db');
const listaBlanca = require('../middlewares/listaBlanca.middleware');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const PROYECTO_ROOT = path.join(BACKEND_ROOT, '..');
const esWindows = process.platform === 'win32';

// En Windows npm/npx son .cmd: sin shell, Node los rechaza (EINVAL). Los
// argumentos siempre son constantes de este archivo, nunca del request.
function ejecutar(cmd, args, { cwd = PROYECTO_ROOT, timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let proc;
    try {
      proc = spawn(cmd, args, { cwd, shell: esWindows && ['npm', 'npx', 'pm2'].includes(cmd), timeout });
    } catch (e) {
      resolve({ ok: false, code: -1, stdout: '', stderr: e.message });
      return;
    }
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (e) => resolve({ ok: false, code: -1, stdout, stderr: stderr || e.message }));
    proc.on('close', (code) => resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

function ejecutarStreaming(res, titulo, cmd, args, cwd = PROYECTO_ROOT) {
  return new Promise((resolve) => {
    res.write(`\n$ ${titulo}\n`);
    let proc;
    try {
      proc = spawn(cmd, args, { cwd, shell: esWindows && ['npm', 'npx', 'pm2'].includes(cmd) });
    } catch (e) {
      res.write(`✗ ${e.message}\n`);
      resolve(-1);
      return;
    }
    proc.stdout.on('data', (d) => res.write(d));
    proc.stderr.on('data', (d) => res.write(d));
    proc.on('error', (e) => { res.write(`✗ ${e.message}\n`); resolve(-1); });
    proc.on('close', (code) => resolve(code));
  });
}

// --- Listas blancas (compartido) ---

function seccionValida(s) {
  if (!['backups', 'actualizaciones'].includes(s)) throw new AppError('Sección inválida', 404);
  return s;
}

const agregarAdmin = asyncHandler(async (req, res) => {
  await listaBlanca.agregar(seccionValida(req.params.seccion), Number(req.body.userId), req.user.id);
  res.status(201).json({ admins: await listaBlanca.listar(req.params.seccion) });
});

const quitarAdmin = asyncHandler(async (req, res) => {
  await listaBlanca.quitar(seccionValida(req.params.seccion), req.params.id, req.user.id);
  res.json({ admins: await listaBlanca.listar(req.params.seccion) });
});

// --- Backups ---

const getBackups = asyncHandler(async (req, res) => {
  const [admins, { listaVacia }] = await Promise.all([listaBlanca.listar('backups'), listaBlanca.tieneAcceso('backups', req.user.id)]);
  res.json({
    admins,
    listaVacia,
    motor: db.client.config.client,
    excluidos: ['.env y .env.*', 'llaves (*.pem, *.key)', 'node_modules', 'data/ (bases)', 'privado/ (archivos privados)', 'uploads/', '.git'],
  });
});

const getBackupDb = asyncHandler(async (req, res) => {
  const fecha = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const cliente = db.client.config.client;

  if (cliente === 'better-sqlite3') {
    const tmp = path.join(os.tmpdir(), `escuela-backup-${Date.now()}.sqlite3`);
    const conexion = await db.client.acquireConnection();
    try {
      await conexion.backup(tmp);
    } finally {
      db.client.releaseConnection(conexion);
    }
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="escuela-${fecha}.sqlite3"`);
    const stream = fs.createReadStream(tmp);
    stream.pipe(res);
    stream.on('close', () => fs.unlink(tmp, () => {}));
    return;
  }

  if (cliente === 'pg') {
    if (!env.DATABASE_URL) throw new AppError('Falta DATABASE_URL', 500);
    const proc = spawn('pg_dump', ['--no-owner', '--no-privileges', env.DATABASE_URL]);
    let arranco = false;
    proc.on('error', () => {
      if (!arranco) res.status(500).json({ error: 'No se encontró pg_dump en el servidor. Instalá las herramientas de cliente de PostgreSQL.' });
    });
    proc.stdout.once('data', () => {
      arranco = true;
      res.set('Content-Type', 'application/sql');
      res.set('Content-Disposition', `attachment; filename="escuela-${fecha}.sql"`);
    });
    proc.stdout.pipe(res);
    return;
  }
  throw new AppError(`Backup no soportado para el motor ${cliente}`, 400);
});

const getBackupProyecto = asyncHandler(async (req, res) => {
  const fecha = new Date().toISOString().slice(0, 10);
  const excluir = ['node_modules', '.env', '.env.*', '*.pem', '*.key', 'data', 'privado', 'uploads', '.git', 'dist', '_to_delete', '*.tar.gz']
    .flatMap((p) => ['--exclude', p]);
  const proc = spawn('tar', [...excluir, '-czf', '-', '-C', PROYECTO_ROOT, '.']);
  let arranco = false;
  proc.on('error', () => {
    if (!arranco) res.status(500).json({ error: 'No se encontró "tar" en el servidor.' });
  });
  proc.stdout.once('data', () => {
    arranco = true;
    res.set('Content-Type', 'application/gzip');
    res.set('Content-Disposition', `attachment; filename="escuela-proyecto-${fecha}.tar.gz"`);
  });
  proc.stdout.pipe(res);
});

// --- Actualizaciones ---

const getActualizaciones = asyncHandler(async (req, res) => {
  const [admins, { listaVacia }] = await Promise.all([listaBlanca.listar('actualizaciones'), listaBlanca.tieneAcceso('actualizaciones', req.user.id)]);
  const [rama, commit] = await Promise.all([
    ejecutar('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    ejecutar('git', ['log', '-1', '--pretty=format:%h · %s · %an · %ad', '--date=format:%d/%m/%Y %H:%M']),
  ]);
  res.json({ admins, listaVacia, rama: rama.ok ? rama.stdout : null, ultimoCommit: commit.ok ? commit.stdout : null, esRepositorio: rama.ok });
});

const DIAGNOSTICOS = {
  estado: { titulo: 'git status', cmd: 'git', args: ['status', '--short', '--branch'] },
  log: { titulo: 'Últimos 15 commits', cmd: 'git', args: ['log', '-15', '--pretty=format:%h %ad %an — %s', '--date=short'] },
  versiones: { titulo: 'Versiones de Node y npm' },
  migraciones: { titulo: 'Migraciones de la base' },
};

const postDiagnostico = asyncHandler(async (req, res) => {
  const def = DIAGNOSTICOS[req.params.tipo];
  if (!def) throw new AppError('Diagnóstico desconocido', 404);
  if (req.params.tipo === 'versiones') {
    const npm = await ejecutar('npm', ['--version']);
    return res.json({ ok: true, titulo: def.titulo, output: `node ${process.version}\nnpm  ${npm.stdout || '?'}` });
  }
  if (req.params.tipo === 'migraciones') {
    const [hechas, pendientes] = await db.migrate.list();
    const nombre = (m) => m.file || m.name || String(m);
    return res.json({ ok: true, titulo: def.titulo, output: `Aplicadas: ${hechas.length}\nPendientes: ${pendientes.length}\n${pendientes.map((m) => `  - ${nombre(m)}`).join('\n')}` });
  }
  const r = await ejecutar(def.cmd, def.args);
  res.json({ ok: r.ok, titulo: def.titulo, output: r.stdout || r.stderr || '(sin salida)' });
});

const postVerPendientes = asyncHandler(async (req, res) => {
  const fetch = await ejecutar('git', ['fetch'], { timeout: 60000 });
  if (!fetch.ok) return res.json({ ok: false, error: `No se pudo hacer git fetch: ${fetch.stderr || fetch.stdout}` });
  const log = await ejecutar('git', ['log', 'HEAD..@{u}', '--pretty=format:%h %ad %an — %s', '--date=short']);
  if (!log.ok) return res.json({ ok: false, error: log.stderr || 'La rama no tiene una rama remota asociada.' });
  res.json({ ok: true, commits: log.stdout ? log.stdout.split('\n') : [] });
});

// Actualizar: la salida se manda en vivo (text/plain por partes).
let actualizando = false;
const postActualizar = asyncHandler(async (req, res) => {
  if (actualizando) throw new AppError('Ya hay una actualización en curso', 409);
  actualizando = true;
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('X-Content-Type-Options', 'nosniff');
  try {
    res.write(`Actualización iniciada por ${req.user.nombre || req.user.email} — ${new Date().toLocaleString('es-AR')}\n`);
    if ((await ejecutarStreaming(res, 'git fetch', 'git', ['fetch'])) !== 0) { res.write('\n✗ Falló git fetch — se cancela. No se tocó nada.\n'); return res.end(); }
    if ((await ejecutarStreaming(res, 'git pull --ff-only', 'git', ['pull', '--ff-only'])) !== 0) { res.write('\n✗ Falló git pull (¿cambios locales o historia divergente?) — se cancela. No se tocó nada.\n'); return res.end(); }
    if ((await ejecutarStreaming(res, 'npm install (backend)', 'npm', ['install'], BACKEND_ROOT)) !== 0) { res.write('\n✗ Falló npm install del backend. El código ya se actualizó; revisar a mano antes de reiniciar.\n'); return res.end(); }
    res.write('\n$ migraciones\n');
    try {
      const [, aplicadas] = await db.migrate.latest();
      res.write(aplicadas.length ? `✓ Aplicadas: ${aplicadas.join(', ')}\n` : '✓ No había migraciones pendientes\n');
    } catch (e) {
      res.write(`✗ Falló una migración: ${e.message}\nRevisar a mano (npm run migrate:rollback si hace falta).\n`);
      return res.end();
    }
    const frontend = path.join(PROYECTO_ROOT, 'frontend');
    if (fs.existsSync(path.join(frontend, 'package.json'))) {
      if ((await ejecutarStreaming(res, 'npm install (frontend)', 'npm', ['install'], frontend)) === 0) {
        await ejecutarStreaming(res, 'npm run build (frontend)', 'npm', ['run', 'build'], frontend);
      }
    }
    // Solo se reinicia el proceso de PM2 de ESTE backend (por su carpeta):
    // en el mismo servidor puede haber otras apps en PM2 que no se tocan.
    const pm2 = await ejecutar('pm2', ['jlist']);
    let propio = null;
    if (pm2.ok) {
      try {
        propio = JSON.parse(pm2.stdout).find((p) => {
          const cwd = (p.pm2_env && (p.pm2_env.pm_cwd || p.pm2_env.cwd)) || '';
          return path.resolve(cwd) === path.resolve(BACKEND_ROOT);
        });
      } catch (_e) {
        propio = null;
      }
    }
    // El nombre sale de PM2 pero igual se valida: en Windows va por shell.
    if (propio && /^[\w.-]+$/.test(String(propio.name))) {
      res.write(`\n✓ Listo. Reiniciando "${propio.name}" en PM2 en 2 segundos…\n`);
      res.end();
      setTimeout(() => spawn('pm2', ['restart', String(propio.name)], { detached: true, stdio: 'ignore', shell: esWindows }).unref(), 2000);
      return undefined;
    }
    res.write('\n✓ Listo. Reiniciá el servidor del backend para que tome el código nuevo (no se detectó PM2).\n');
    return res.end();
  } finally {
    actualizando = false;
  }
});

module.exports = {
  agregarAdmin,
  quitarAdmin,
  getBackups,
  getBackupDb,
  getBackupProyecto,
  getActualizaciones,
  postDiagnostico,
  postVerPendientes,
  postActualizar,
};
