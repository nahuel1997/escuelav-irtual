// PDF de progreso para alumnos ("mi avance en cada curso") y profesores
// ("avance de los alumnos de mis cursos"), con opción de mandarlo por mail
// (el equivalente al historial en PDF del cliente/consultor de DBA24).
const reportes = require('../../reportes.service');
const envioPdf = require('../../envioPdf.service');
const { generarPdf } = require('../../../utils/pdfReporte');

module.exports = {
  roles: ['alumno', 'profesor'],
  titulo: (p, user) => `${user.rol === 'profesor' ? 'Avance de mis alumnos' : 'Mi progreso'} (PDF)${p.destinatario ? ` → ${p.destinatario}` : ''}`,
  async validar(p, user) {
    if (!p.destinatario) return {};
    return { destinatario: await envioPdf.validarDestino(user.id, p.destinatario), mensaje: String(p.mensaje || '').slice(0, 2000) };
  },
  async ejecutar({ params, user, progreso }) {
    const esProfe = user.rol === 'profesor';
    const datos = await reportes.progreso(esProfe ? { profesorId: user.id } : { userId: user.id });
    await progreso(50);
    const bloques = [];
    if (esProfe) {
      datos.cursos.forEach((c) => {
        bloques.push({ tipo: 'titulo', texto: `${c.titulo} — promedio ${c.promedio}%` });
        bloques.push({ tipo: 'tabla', columnas: [{ titulo: 'Alumno', ancho: 2.5 }, { titulo: 'Capítulos' }, { titulo: 'Avance' }, { titulo: 'Terminó' }], filas: c.alumnos.map((a) => [a.alumno, `${a.capitulosCompletados}/${a.capitulosTotales}`, `${a.porcentaje}%`, a.completado ? 'Sí' : 'No']) });
      });
    } else {
      const mios = datos.cursos.filter((c) => c.alumnos.length);
      bloques.push({ tipo: 'tabla', columnas: [{ titulo: 'Curso', ancho: 3 }, { titulo: 'Capítulos' }, { titulo: 'Avance' }, { titulo: 'Terminado' }], filas: mios.map((c) => [c.titulo, `${c.alumnos[0].capitulosCompletados}/${c.capitulos}`, `${c.alumnos[0].porcentaje}%`, c.alumnos[0].completado ? 'Sí' : 'No']) });
    }
    if (!bloques.length) bloques.push({ tipo: 'parrafo', texto: 'Todavía no hay cursos para mostrar.' });
    const titulo = esProfe ? 'Avance de mis alumnos' : 'Mi progreso';
    const buffer = await generarPdf({ titulo, subtitulo: `${user.nombre} ${user.apellido}`, bloques });
    const nombre = `${esProfe ? 'avance-alumnos' : 'mi-progreso'}-${new Date().toISOString().slice(0, 10)}.pdf`;
    let enviadoA = null;
    if (params.destinatario) {
      await progreso(80);
      enviadoA = await envioPdf.enviar({ user, destinatario: params.destinatario, titulo, mensaje: params.mensaje, buffer, nombreArchivo: nombre });
    }
    return { archivo: { buffer, nombre, mime: 'application/pdf' }, resultado: { enviadoA } };
  },
};
