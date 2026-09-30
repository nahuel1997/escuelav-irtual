// Reporte del panel de admin en PDF (ventas, inscripciones, progreso,
// profesores, encuestas), con opción de mandarlo por mail.
const reportes = require('../../reportes.service');
const envioPdf = require('../../envioPdf.service');
const { AppError } = require('../../../middlewares/error.middleware');

module.exports = {
  roles: ['admin'],
  titulo: (p) => `Reporte: ${reportes.TIPOS[p.reporte]}${p.destinatario ? ` → ${p.destinatario}` : ''}`,
  async validar(p, user) {
    if (!reportes.TIPOS[p.reporte]) throw new AppError('Reporte desconocido', 400);
    const limpio = { reporte: p.reporte };
    if (p.desde) limpio.desde = String(p.desde).slice(0, 10);
    if (p.hasta) limpio.hasta = String(p.hasta).slice(0, 10);
    if (p.courseId) limpio.courseId = Number(p.courseId);
    if (p.destinatario) {
      limpio.destinatario = await envioPdf.validarDestino(user.id, p.destinatario);
      limpio.mensaje = String(p.mensaje || '').slice(0, 2000);
    }
    return limpio;
  },
  async ejecutar({ params, user, progreso }) {
    const datos = await reportes.generar(params.reporte, params);
    await progreso(50);
    const buffer = await reportes.armarPdf(params.reporte, datos);
    const nombre = `reporte-${params.reporte}-${new Date().toISOString().slice(0, 10)}.pdf`;
    let enviadoA = null;
    if (params.destinatario) {
      await progreso(80);
      enviadoA = await envioPdf.enviar({ user, destinatario: params.destinatario, titulo: `Reporte: ${reportes.TIPOS[params.reporte]}`, mensaje: params.mensaje, buffer, nombreArchivo: nombre });
    }
    return { archivo: { buffer, nombre, mime: 'application/pdf' }, resultado: { enviadoA } };
  },
};
