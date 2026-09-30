// Limpieza diaria: que los registros de operación no crezcan para siempre.
// - Tráfico e intentos de login: 90 días.
// - Archivos generados por procesos: 7 días (la fila del proceso queda,
//   sin archivo).
// - privado/tmp: lo que haya quedado de más de un día.
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { haceDias } = require('../utils/sqlFecha');
const storage = require('../services/storage.service');
const traficoModel = require('../models/trafico.model');
const loginEventoModel = require('../models/loginEvento.model');

const DIAS_ARCHIVOS_PROCESOS = 7;

async function correrJobLimpieza() {
  let total = 0;
  total += await traficoModel.limpiarViejos(90);
  total += await loginEventoModel.limpiarViejos(90);

  const limite = haceDias(DIAS_ARCHIVOS_PROCESOS);
  const viejos = await db('procesos').whereNotNull('archivo').where('terminado_en', '<', limite).select('id', 'archivo');
  for (const p of viejos) {
    await fs.promises.unlink(storage.rutaPrivada('procesos', p.archivo)).catch(() => {});
    await db('procesos').where({ id: p.id }).update({ archivo: null });
    total += 1;
  }

  const tmp = storage.carpetaPrivada('tmp');
  for (const f of await fs.promises.readdir(tmp).catch(() => [])) {
    const ruta = path.join(tmp, f);
    const st = await fs.promises.stat(ruta).catch(() => null);
    if (st && st.mtimeMs < Date.now() - 86400000) {
      await fs.promises.unlink(ruta).catch(() => {});
      total += 1;
    }
  }
  return total;
}

module.exports = { correrJobLimpieza };
