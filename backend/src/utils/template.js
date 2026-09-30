// Reemplazo simple de {{variable}} por su valor en un texto — el mismo
// mecanismo lo usan las plantillas de mail (mail.service.js) y las
// plantillas de CV para IA (services/cvAi/templateEngine.js), así que
// vive acá para no duplicar la misma regex en los dos lados.
//
// A propósito NO es un motor de templates con loops/condicionales
// (Handlebars y similares): todo lo que hoy necesita repetirse (una
// lista de experiencia laboral, de cursos, etc.) se arma como un
// fragmento de HTML ya resuelto ANTES de llamar a esto, y se pasa como
// una variable más — mismo criterio que ya usaba mail.service.js.
//
// Una variable pedida que no vino en `variables` se reemplaza por string
// vacío en vez de dejar "{{lo_que_sea}}" visible en el resultado final.
function renderTexto(texto, variables) {
  return String(texto || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, nombre) => {
    const valor = variables[nombre];
    return valor === undefined || valor === null ? '' : String(valor);
  });
}

// renderTexto NO escapa (hay variables que son fragmentos de HTML armados a
// propósito). Todo texto que escribe un usuario (un reporte de error, un
// ticket, el mensaje de un reenvío) pasa por acá antes de meterse en un
// mail, para que no pueda inyectar HTML/links en el mail de otra persona.
function escaparHtml(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { renderTexto, escaparHtml };
