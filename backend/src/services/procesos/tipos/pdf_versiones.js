// Registro de versiones en PDF, en segundo plano (cualquier usuario
// logueado lo puede pedir desde "Novedades").
const db = require('../../../config/db');
const { generarPdf } = require('../../../utils/pdfReporte');

module.exports = {
  roles: ['alumno', 'profesor', 'admin', 'soporte'],
  titulo: () => 'Novedades de la plataforma (PDF)',
  validar: () => ({}),
  async ejecutar({ progreso }) {
    const versiones = await db('versiones').select('*').orderBy('fecha', 'desc').orderBy('id', 'desc');
    await progreso(40);
    const bloques = [];
    versiones.forEach((v) => {
      bloques.push({ tipo: 'titulo', texto: `${v.version} — ${v.titulo}` });
      bloques.push({ tipo: 'parrafo', texto: new Date(`${String(v.fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR') });
      bloques.push({ tipo: 'lista', items: String(v.cambios).split('\n') });
    });
    if (!versiones.length) bloques.push({ tipo: 'parrafo', texto: 'Todavía no hay novedades cargadas.' });
    const buffer = await generarPdf({ titulo: 'Novedades de la plataforma', subtitulo: 'Escuela Online', bloques });
    return { archivo: { buffer, nombre: 'novedades.pdf', mime: 'application/pdf' }, resultado: { versiones: versiones.length } };
  },
};
