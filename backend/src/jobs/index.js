// Arranca los 3 jobs programados (recordatorio de turno, carrito
// abandonado, inactividad) con node-cron, corriendo dentro del propio
// proceso del backend — no hace falta infraestructura aparte (un
// scheduler externo, un worker separado) para una app de este tamaño.
//
// Se llama SOLO desde el bloque `if (require.main === module)` de app.js
// (igual que app.listen() y chequearMigraciones()), nunca al importar
// app.js como módulo — así los tests (que hacen require('../src/app') sin
// ejecutarlo directamente) nunca disparan un cron job de fondo compitiendo
// con sus propias bases de test aisladas.
const cron = require('node-cron');
const env = require('../config/env');
const { correrJobRecordatorioCitas } = require('./recordatorioCitas.job');
const { correrJobCarritoAbandonado } = require('./carritoAbandonado.job');
const { correrJobInactividad } = require('./inactividad.job');

// Envuelve cada job para que un error dentro de uno no tire abajo el cron
// scheduler ni afecte a los otros jobs — mismo espíritu "best effort" que
// el resto de las tareas de fondo de la app (ver mail.service.js).
function seguro(nombre, fn) {
  return async () => {
    try {
      const cantidad = await fn();
      if (cantidad > 0) console.log(`[jobs] ${nombre}: ${cantidad} mail(es) procesado(s)`);
    } catch (err) {
      console.error(`[jobs] Falló "${nombre}":`, err.message);
    }
  };
}

function iniciar() {
  if (!env.JOBS_HABILITADOS) {
    console.log('[jobs] Deshabilitados por JOBS_HABILITADOS=false');
    return;
  }

  // Cada 5 minutos: suficiente resolución para un recordatorio de 30 min.
  cron.schedule('*/5 * * * *', seguro('recordatorio de turnos', correrJobRecordatorioCitas));
  // Cada 30 minutos: no hace falta más frecuencia para un umbral medido en horas.
  cron.schedule('*/30 * * * *', seguro('carrito abandonado', correrJobCarritoAbandonado));
  // Una vez por día a las 9am (hora del servidor): un umbral medido en días
  // no necesita chequearse más seguido.
  cron.schedule('0 9 * * *', seguro('inactividad (te extrañamos)', correrJobInactividad));

  console.log('[jobs] Jobs programados iniciados (recordatorio de turnos, carrito abandonado, inactividad)');
}

module.exports = { iniciar };
