// Tareas programadas, configurables desde Admin → Configuración → "Tareas
// programadas" (activar/desactivar, cambiar el horario, ejecutar ahora) —
// mismo espíritu que la hora de envío configurable de DBA24. Corren con
// node-cron dentro del propio proceso del backend.
//
// El horario de cada una vive en jobs_config (se crea con el valor por
// defecto la primera vez). Cada ejecución guarda cuándo corrió y cómo le
// fue, para verlo en el panel.
//
// Se inician SOLO desde el bloque `if (require.main === module)` de app.js:
// los tests nunca disparan un job de fondo. JOBS_HABILITADOS=false sigue
// siendo la llave general para apagarlos todos sin tocar la base.
const cron = require('node-cron');
const env = require('../config/env');
const db = require('../config/db');
const { correrJobRecordatorioCitas } = require('./recordatorioCitas.job');
const { correrJobCarritoAbandonado } = require('./carritoAbandonado.job');
const { correrJobInactividad } = require('./inactividad.job');
const { correrJobLimpieza } = require('./limpieza.job');

// clave -> { nombre, descripcion, cron por defecto, función }
const JOBS = {
  recordatorio_citas: {
    nombre: 'Recordatorio de turnos',
    descripcion: 'Mail de recordatorio antes de cada turno alumno-profesor.',
    cron: '*/5 * * * *',
    fn: correrJobRecordatorioCitas,
  },
  carrito_abandonado: {
    nombre: 'Carrito abandonado',
    descripcion: 'Mail a quien dejó cursos en el carrito sin comprar.',
    cron: '*/30 * * * *',
    fn: correrJobCarritoAbandonado,
  },
  inactividad: {
    nombre: '"Te extrañamos" (inactividad)',
    descripcion: 'Mail a alumnos y profesores que hace mucho no entran.',
    cron: '0 9 * * *',
    fn: correrJobInactividad,
  },
  metricas_horarias: {
    nombre: 'Métricas del servidor',
    descripcion: 'Foto horaria para el análisis de Estado de la app.',
    cron: '0 * * * *',
    fn: () => require('../services/metricas.service').registrarMetrica(),
  },
  limpieza: {
    nombre: 'Limpieza de registros',
    descripcion: 'Borra tráfico e intentos de login de más de 90 días y archivos de procesos de más de 7.',
    cron: '30 3 * * *',
    fn: correrJobLimpieza,
  },
  campanias: {
    nombre: 'Campañas de mail programadas',
    descripcion: 'Manda las campañas de publicidad cuya fecha de envío ya llegó.',
    cron: '* * * * *',
    fn: () => require('../services/campanias.service').enviarCampaniasVencidas(),
  },
};

const tareas = {}; // clave -> ScheduledTask
let iniciado = false;

async function config(clave) {
  let fila = await db('jobs_config').where({ clave }).first();
  if (!fila) {
    await db('jobs_config').insert({ clave, cron: JOBS[clave].cron, activo: true });
    fila = await db('jobs_config').where({ clave }).first();
  }
  return { ...fila, activo: Boolean(fila.activo), ultimo_ok: fila.ultimo_ok === null ? null : Boolean(fila.ultimo_ok) };
}

// Corre un job y deja registro. Nunca tira: un error en uno no afecta al
// resto ni al scheduler.
async function ejecutar(clave) {
  const job = JOBS[clave];
  const inicio = Date.now();
  let ok = true;
  let resultado;
  try {
    const cantidad = await job.fn();
    resultado = `${typeof cantidad === 'number' ? `${cantidad} procesado(s)` : 'OK'} en ${Date.now() - inicio} ms`;
    if (typeof cantidad === 'number' && cantidad > 0) console.log(`[jobs] ${job.nombre}: ${resultado}`);
  } catch (err) {
    ok = false;
    resultado = `Error: ${err.message}`.slice(0, 500);
    console.error(`[jobs] Falló "${job.nombre}":`, err);
  }
  await db('jobs_config').where({ clave }).update({ ultima_ejecucion: db.fn.now(), ultimo_resultado: resultado, ultimo_ok: ok, updated_at: db.fn.now() }).catch(() => {});
  return { ok, resultado };
}

async function programar(clave) {
  if (tareas[clave]) {
    tareas[clave].stop();
    delete tareas[clave];
  }
  const c = await config(clave);
  if (!c.activo || !cron.validate(c.cron)) return;
  tareas[clave] = cron.schedule(c.cron, () => { ejecutar(clave); });
}

async function iniciar() {
  if (!env.JOBS_HABILITADOS) {
    console.log('[jobs] Deshabilitados por JOBS_HABILITADOS=false');
    return;
  }
  iniciado = true;
  for (const clave of Object.keys(JOBS)) {
    await programar(clave).catch((e) => console.error(`[jobs] No se pudo programar ${clave}:`, e.message));
  }
  console.log(`[jobs] Tareas programadas iniciadas (${Object.keys(tareas).length} activas)`);
}

async function listar() {
  const lista = [];
  for (const [clave, job] of Object.entries(JOBS)) {
    const c = await config(clave);
    lista.push({
      clave,
      nombre: job.nombre,
      descripcion: job.descripcion,
      cronPorDefecto: job.cron,
      cron: c.cron,
      activo: c.activo,
      programado: Boolean(tareas[clave]),
      ultimaEjecucion: c.ultima_ejecucion,
      ultimoResultado: c.ultimo_resultado,
      ultimoOk: c.ultimo_ok,
    });
  }
  return { jobs: lista, schedulerActivo: iniciado, habilitadosPorEnv: env.JOBS_HABILITADOS };
}

async function actualizar(clave, { activo, cron: expr }) {
  if (!JOBS[clave]) return null;
  await config(clave);
  const patch = { updated_at: db.fn.now() };
  if (activo !== undefined) patch.activo = Boolean(activo);
  if (expr !== undefined) {
    const limpio = String(expr).trim();
    if (!cron.validate(limpio)) {
      const { AppError } = require('../middlewares/error.middleware');
      throw new AppError('Horario inválido. Formato cron de 5 campos, ej: "0 9 * * *" = todos los días a las 9.', 400);
    }
    patch.cron = limpio;
  }
  await db('jobs_config').where({ clave }).update(patch);
  if (iniciado) await programar(clave);
  return config(clave);
}

module.exports = { iniciar, listar, actualizar, ejecutar, JOBS };
