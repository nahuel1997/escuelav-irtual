// Seed de las 3 plantillas de "CV para IA" (cv_ai_templates): ChatGPT,
// Claude y Gemini. Mismo criterio que 002_email_templates.js: seed
// IDEMPOTENTE (onConflict('clave').merge()), no depende de FORCE_SEED —
// son datos "de producto", no datos de prueba descartables. Documentado
// igual que allá: si el admin ya editó una plantilla desde
// /admin-panel/cv-ia y se vuelve a correr `npm run seed`, el merge la
// pisa con esta versión de fábrica — pensado para la instalación inicial,
// no como parte de un reset de rutina.
//
// Cada "html" de acá abajo es el documento HTML COMPLETO que el alumno
// va a ver/descargar (no un fragmento) — el editor de /admin-panel/cv-ia
// deja tocar este texto tal cual, así que lo que el admin ve ahí es
// exactamente lo que le llega al alumno. Las variables disponibles están
// documentadas en la constante VARIABLES de más abajo y las resuelve
// services/cvAi/templateEngine.js: los datos que carga el alumno a mano
// (nombreCompleto, email, etc.) llegan ya escapados; las listas
// (experiencia, educación, habilidades, idiomas, cursos de la plataforma,
// recomendaciones) llegan pre-armadas como fragmentos de HTML listos para
// insertar (experienciaHtml, educacionHtml, etc.) — este seed no necesita
// (ni puede) iterar arrays, es sustitución simple de {{variable}}.
const VARIABLES =
  'nombreCompleto,email,telefono,ubicacion,linkedin,resumenProfesional,' +
  'experienciaHtml,educacionHtml,habilidadesHtml,idiomasHtml,cursosPlataformaHtml,' +
  'nivelIAEtiqueta,nivelIADescripcion,recomendacionesHtml,fechaGeneracion,destino';

const COLOR_TEXTO = '#1a1f26';
const COLOR_MUTED = '#5b6470';
const COLOR_BORDE = '#e3e7ed';

// Shell común a los 3: encabezado con nota para la IA (explica qué es
// este documento y cómo usarlo) + secciones con los datos. Lo único que
// cambia entre plantillas es el texto de la nota inicial y el color de
// acento — a propósito, para que las 3 sean plantillas de verdad
// independientes desde el primer momento (el admin puede des-sincronizar
// una de las otras dos sin que nada se rompa), no una sola plantilla
// parametrizada por destino.
function armarShell({ colorAcento, notaParaLaIa }) {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>{{nombreCompleto}} — CV para {{destino}}</title>
    <style>
      body { font-family: -apple-system, Arial, sans-serif; color: ${COLOR_TEXTO}; max-width: 720px; margin: 32px auto; padding: 0 16px; line-height: 1.5; }
      h1 { margin-bottom: 2px; }
      .contacto { color: ${COLOR_MUTED}; font-size: 0.92rem; margin-top: 0; }
      .nota-ia { background: #f5f7fa; border-left: 4px solid ${colorAcento}; padding: 12px 16px; font-size: 0.88rem; color: ${COLOR_MUTED}; margin: 16px 0 24px; }
      h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.03em; color: ${colorAcento}; border-bottom: 1px solid ${COLOR_BORDE}; padding-bottom: 4px; margin-top: 28px; }
      ul { padding-left: 20px; margin: 8px 0; }
      li { margin-bottom: 8px; }
      .nivel { background: #f5f7fa; border-radius: 8px; padding: 12px 16px; }
      .nivel strong { color: ${colorAcento}; }
      footer { margin-top: 32px; font-size: 0.78rem; color: ${COLOR_MUTED}; border-top: 1px solid ${COLOR_BORDE}; padding-top: 8px; }
    </style>
  </head>
  <body>
    <h1>{{nombreCompleto}}</h1>
    <p class="contacto">{{email}} · {{telefono}} · {{ubicacion}} · {{linkedin}}</p>

    <div class="nota-ia">${notaParaLaIa}</div>

    <h2>Resumen profesional</h2>
    <p>{{resumenProfesional}}</p>

    <h2>Nivel en IA aplicada a oficina</h2>
    <div class="nivel">
      <strong>{{nivelIAEtiqueta}}</strong>
      <p style="margin: 6px 0 0;">{{nivelIADescripcion}}</p>
    </div>

    <h2>Experiencia laboral</h2>
    {{experienciaHtml}}

    <h2>Educación</h2>
    {{educacionHtml}}

    <h2>Habilidades</h2>
    <p>{{habilidadesHtml}}</p>

    <h2>Idiomas</h2>
    <p>{{idiomasHtml}}</p>

    <h2>Cursos y certificaciones de la plataforma</h2>
    {{cursosPlataformaHtml}}

    <h2>Contenido recomendado para seguir avanzando</h2>
    {{recomendacionesHtml}}

    <footer>CV generado el {{fechaGeneracion}} — formato pensado para {{destino}}.</footer>
  </body>
</html>`;
}

const PLANTILLAS = [
  {
    clave: 'chatgpt',
    nombre: 'ChatGPT',
    html: armarShell({
      colorAcento: '#10a37f',
      notaParaLaIa:
        'Nota para la IA: este documento es el perfil profesional completo de {{nombreCompleto}}. ' +
        'Usalo como contexto para responder preguntas sobre su experiencia, ayudar a redactar cartas de ' +
        'presentación, o adaptar este perfil a una búsqueda laboral puntual.',
    }),
    variables_disponibles: VARIABLES,
  },
  {
    clave: 'claude',
    nombre: 'Claude',
    html: armarShell({
      colorAcento: '#c96442',
      notaParaLaIa:
        'Nota para la IA: a continuación se detalla el perfil profesional completo de {{nombreCompleto}}, ' +
        'con su experiencia, formación y nivel actual en IA aplicada a oficina. Usalo como contexto de fondo ' +
        'para cualquier tarea relacionada (armar un CV a medida, preparar una entrevista, redactar un mensaje ' +
        'de contacto).',
    }),
    variables_disponibles: VARIABLES,
  },
  {
    clave: 'gemini',
    nombre: 'Gemini',
    html: armarShell({
      colorAcento: '#4285f4',
      notaParaLaIa:
        'Nota para la IA: este es el perfil profesional completo de {{nombreCompleto}}. Tomalo como fuente de ' +
        'verdad sobre su trayectoria y nivel en IA aplicada a oficina antes de generar cualquier contenido ' +
        'derivado (resumen ejecutivo, comparación con un puesto, etc.).',
    }),
    variables_disponibles: VARIABLES,
  },
];

exports.seed = async function (knex) {
  for (const plantilla of PLANTILLAS) {
    await knex('cv_ai_templates')
      .insert({ ...plantilla, activo: true })
      .onConflict('clave')
      .merge(['nombre', 'html', 'variables_disponibles']);
  }
};
