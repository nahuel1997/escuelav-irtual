// templateEngine.js — el único "motor" de CV para IA que existe hoy (ver
// ./index.js para el registro completo). Arma un documento HTML completo
// a partir de la plantilla que cargó el admin (cv_ai_templates.html,
// editable desde /admin-panel/cv-ia) sustituyendo variables — sin ningún
// modelo de IA de por medio, es texto + reglas fijas (nivel según
// cantidad de cursos completados, ver config/nivelesIA.js).
//
// Los datos que carga el alumno a mano (nombre, experiencia, etc.) se
// escapan acá antes de insertarlos en el HTML — no porque otro usuario
// vaya a ver este documento (lo genera y descarga el propio alumno), sino
// para que un dato con "&", "<" o similares no rompa el HTML resultante.
const { renderTexto } = require('../../utils/template');

function escapeHtml(valor) {
  return String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Arma un <ul> a partir de una lista, con `render(item)` devolviendo el
// HTML interno de cada <li>. Lista vacía o ausente → string vacío (el
// {{variable}} en la plantilla queda en blanco, no aparece "<ul></ul>"
// suelto).
function listaHtml(items, render) {
  if (!items || !items.length) return '';
  return `<ul>${items.map((item) => `<li>${render(item)}</li>`).join('')}</ul>`;
}

function experienciaHtml(experiencia) {
  return listaHtml(experiencia, (exp) => {
    const titulo = [exp.puesto, exp.empresa].filter(Boolean).map(escapeHtml).join(' — ');
    const periodo = exp.periodo ? ` <em>(${escapeHtml(exp.periodo)})</em>` : '';
    const descripcion = exp.descripcion ? `<br>${escapeHtml(exp.descripcion)}` : '';
    return `<strong>${titulo}</strong>${periodo}${descripcion}`;
  });
}

function educacionHtml(educacion) {
  return listaHtml(educacion, (ed) => {
    const titulo = [ed.titulo, ed.institucion].filter(Boolean).map(escapeHtml).join(' — ');
    const periodo = ed.periodo ? ` <em>(${escapeHtml(ed.periodo)})</em>` : '';
    return `<strong>${titulo}</strong>${periodo}`;
  });
}

function habilidadesHtml(habilidades) {
  if (!habilidades || !habilidades.length) return '';
  return habilidades.map(escapeHtml).join(', ');
}

function idiomasHtml(idiomas) {
  if (!idiomas || !idiomas.length) return '';
  return idiomas.map((i) => `${escapeHtml(i.idioma)}${i.nivel ? ` (${escapeHtml(i.nivel)})` : ''}`).join(', ');
}

function cursosPlataformaHtml(cursos) {
  return listaHtml(cursos, (c) => escapeHtml(c.titulo) + (c.categoria ? ` <em>(${escapeHtml(c.categoria)})</em>` : ''));
}

function recomendacionesHtml(recomendaciones) {
  return listaHtml(recomendaciones, (r) => `${escapeHtml(r.titulo)} — <span>${escapeHtml(r.motivo)}</span>`);
}

// `plantilla` es la fila de cv_ai_templates (clave/nombre/html) ya
// resuelta y activa — la valida quien llama (ver cv.controller.js).
function generar({
  plantilla,
  datosPersonales = {},
  experiencia = [],
  educacion = [],
  habilidades = [],
  idiomas = [],
  cursosPlataforma = [],
  nivel,
  recomendaciones = [],
}) {
  const variables = {
    nombreCompleto: escapeHtml(datosPersonales.nombreCompleto),
    email: escapeHtml(datosPersonales.email),
    telefono: escapeHtml(datosPersonales.telefono),
    ubicacion: escapeHtml(datosPersonales.ubicacion),
    linkedin: escapeHtml(datosPersonales.linkedin),
    resumenProfesional: escapeHtml(datosPersonales.resumenProfesional),
    experienciaHtml: experienciaHtml(experiencia),
    educacionHtml: educacionHtml(educacion),
    habilidadesHtml: habilidadesHtml(habilidades),
    idiomasHtml: idiomasHtml(idiomas),
    cursosPlataformaHtml: cursosPlataformaHtml(cursosPlataforma),
    nivelIAEtiqueta: escapeHtml(nivel?.etiqueta),
    nivelIADescripcion: escapeHtml(nivel?.descripcion),
    recomendacionesHtml: recomendacionesHtml(recomendaciones),
    fechaGeneracion: new Date().toLocaleDateString('es-AR'),
    destino: escapeHtml(plantilla.nombre),
  };

  return { html: renderTexto(plantilla.html, variables) };
}

module.exports = { generar };
