// =============================================================================
// cv.service.js — Generador de CV en PDF.
//
// Arma el PDF a partir de la info que el usuario carga en el formulario del
// "Creador de CV" (datos personales, experiencia, educación, habilidades,
// idiomas) y, opcionalmente, la completa con los cursos que ya terminó y
// los logros que obtuvo dentro de la plataforma.
//
// Usamos pdfkit (dibuja el PDF programáticamente) en vez de convertir HTML
// con un navegador headless (puppeteer): pdfkit no depende de descargar un
// Chromium y es mucho más liviano/confiable para correr en la compu del
// usuario sin pasos extra de instalación.
// =============================================================================
const PDFDocument = require('pdfkit');
const courseModel = require('../models/course.model');
const enrollmentModel = require('../models/enrollment.model');
const { calcularNivel } = require('../config/nivelesIA');

const AZUL = '#1c3d5a';
const GRIS = '#555555';

// Misma categoría fija que se usa en config/categorias.js y en el catálogo
// de cursos (ver seed 001_demo_data.js) — el nivel sugerido y las
// recomendaciones de abajo solo miran cursos de acá, no el catálogo
// entero (un curso de otra categoría no dice nada sobre el nivel de IA
// del alumno).
const CATEGORIA_IA = 'Inteligencia Artificial';

// Cursos de la categoría IA que el usuario ya completó (enrollments.
// completado_at no nulo) — insumo tanto del nivel sugerido como de las
// recomendaciones. Sin usuario (CV anónimo) no hay nada que consultar.
async function cursosIACompletados(userId) {
  if (!userId) return [];
  const inscriptos = await enrollmentModel.listForUser(userId);
  return inscriptos.filter((c) => c.categoria === CATEGORIA_IA && c.completado_at);
}

// Nivel de "IA aplicada a oficina" que el CV sugiere por defecto (ver
// config/nivelesIA.js) — puramente la cantidad de cursos IA completados,
// nada más. Anónimo o sin cursos completados todavía: nivel inicial.
async function calcularNivelIA(userId) {
  const completados = await cursosIACompletados(userId);
  return calcularNivel(completados.length);
}

// Hasta 2 cursos de la categoría IA que el alumno todavía no completó,
// para sugerir dentro del propio CV ("seguí con..."). Sin usuario
// logueado devuelve el arranque sugerido del catálogo completo (para que
// un CV anónimo igual muestre algo, no una sección vacía). El orden es
// por id ascendente a propósito: coincide con el orden pedagógico en el
// que se cargaron los cursos en el seed (fundamentos → automatización →
// integración con LMS), no con el "más nuevo primero" que usa
// courseModel.listAll para el resto de la app.
async function getRecomendaciones(userId) {
  const catalogo = (await courseModel.listAll({ categoria: CATEGORIA_IA, estado: 'subido' }))
    .slice()
    .sort((a, b) => a.id - b.id);

  let completadosIds = new Set();
  if (userId) {
    const completados = await cursosIACompletados(userId);
    completadosIds = new Set(completados.map((c) => c.id));
  }

  return catalogo
    .filter((c) => !completadosIds.has(c.id))
    .slice(0, 2)
    .map((c) => ({
      id: c.id,
      titulo: c.titulo,
      motivo: completadosIds.size
        ? 'Para seguir avanzando en IA aplicada a la oficina.'
        : 'Recomendado como punto de partida en IA aplicada a la oficina.',
    }));
}

function seccionTitulo(doc, texto) {
  doc.moveDown(0.8);
  doc.fillColor(AZUL).fontSize(13).font('Helvetica-Bold').text(texto.toUpperCase());
  doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor(AZUL).stroke();
  doc.moveDown(0.4);
  doc.fillColor('#000000').font('Helvetica').fontSize(10);
}

function generateCvPdf(res, { datosPersonales = {}, experiencia = [], educacion = [], habilidades = [], idiomas = [], cursosPlataforma = [], logrosPlataforma = [] }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // El PDF se transmite directo a la respuesta HTTP a medida que se genera.
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="cv-${(datosPersonales.nombreCompleto || 'usuario').replace(/\s+/g, '_')}.pdf"`);
  doc.pipe(res);

  // --- Encabezado ---
  doc.fillColor(AZUL).fontSize(22).font('Helvetica-Bold').text(datosPersonales.nombreCompleto || 'Nombre Apellido');
  doc.fillColor(GRIS).fontSize(10).font('Helvetica');
  const contacto = [datosPersonales.email, datosPersonales.telefono, datosPersonales.ubicacion, datosPersonales.linkedin]
    .filter(Boolean)
    .join('   |   ');
  if (contacto) doc.text(contacto);

  if (datosPersonales.resumenProfesional) {
    doc.moveDown(0.6);
    doc.fillColor('#000000').fontSize(10.5).text(datosPersonales.resumenProfesional, { align: 'justify' });
  }

  // --- Experiencia ---
  if (experiencia.length) {
    seccionTitulo(doc, 'Experiencia laboral');
    experiencia.forEach((exp) => {
      doc.font('Helvetica-Bold').text(`${exp.puesto || ''}${exp.empresa ? ' — ' + exp.empresa : ''}`);
      if (exp.periodo) doc.font('Helvetica-Oblique').fillColor(GRIS).fontSize(9).text(exp.periodo);
      doc.fillColor('#000000').font('Helvetica').fontSize(10);
      if (exp.descripcion) doc.text(exp.descripcion, { align: 'justify' });
      doc.moveDown(0.5);
    });
  }

  // --- Educación ---
  if (educacion.length) {
    seccionTitulo(doc, 'Educación');
    educacion.forEach((ed) => {
      doc.font('Helvetica-Bold').text(`${ed.titulo || ''}${ed.institucion ? ' — ' + ed.institucion : ''}`);
      if (ed.periodo) doc.font('Helvetica-Oblique').fillColor(GRIS).fontSize(9).text(ed.periodo);
      doc.fillColor('#000000').font('Helvetica').fontSize(10);
      doc.moveDown(0.4);
    });
  }

  // --- Cursos y certificaciones (de la plataforma, si se pidió incluirlos) ---
  if (cursosPlataforma.length) {
    seccionTitulo(doc, 'Cursos y certificaciones');
    cursosPlataforma.forEach((c) => {
      doc.text(`• ${c.titulo}${c.categoria ? ' (' + c.categoria + ')' : ''}`);
    });
  }

  // --- Logros ---
  if (logrosPlataforma.length) {
    seccionTitulo(doc, 'Logros');
    logrosPlataforma.forEach((l) => {
      doc.text(`${l.icono || '🏆'} ${l.titulo}`);
    });
  }

  // --- Habilidades ---
  if (habilidades.length) {
    seccionTitulo(doc, 'Habilidades');
    doc.text(habilidades.join('   •   '));
  }

  // --- Idiomas ---
  if (idiomas.length) {
    seccionTitulo(doc, 'Idiomas');
    doc.text(idiomas.map((i) => `${i.idioma}${i.nivel ? ' (' + i.nivel + ')' : ''}`).join('   •   '));
  }

  doc.end();
}

module.exports = { generateCvPdf, calcularNivelIA, getRecomendaciones };
