// Envío de una campaña de mail (lo encola "Enviar ahora" o la tarea
// programada "campanias" cuando llega la hora). Ver campanias.service.js.
const campanias = require('../../campanias.service');
const { AppError } = require('../../../middlewares/error.middleware');

module.exports = {
  roles: ['admin'],
  titulo: (p) => `Envío de la campaña #${p.campaniaId}`,
  validar(p) {
    const id = Number(p.campaniaId);
    if (!Number.isInteger(id) || id < 1) throw new AppError('Campaña inválida', 400);
    return { campaniaId: id };
  },
  async ejecutar({ params, progreso }) {
    try {
      return { resultado: await campanias.ejecutarEnvio(params.campaniaId, progreso) };
    } catch (err) {
      // Si falla a mitad, la campaña queda en "error" (lo ya mandado no se
      // repite: al reintentar el proceso solo se mandan los pendientes).
      await require('../../../config/db')('campanias').where({ id: params.campaniaId }).update({ estado: 'error' }).catch(() => {});
      throw err;
    }
  },
};
