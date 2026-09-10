// Seed de los 3 instructivos de "Integraciones IA" (ai_integration_templates):
// el texto que ve el alumno al desplegar cada sección de la pestaña
// Vinculaciones, explicando paso a paso cómo sacar su propia API key.
// Mismo criterio idempotente que 002_email_templates.js y
// 003_cv_ai_templates.js (onConflict('clave').merge()): son datos "de
// producto", no de prueba — si el admin ya editó un instructivo desde
// /admin-panel/ai-integraciones y se corre `npm run seed` de nuevo, el
// merge lo pisa con esta versión de fábrica (pensado para la instalación
// inicial, no como parte de un reset de rutina).
//
// Es HTML FRAGMENTO (no un documento completo como cv_ai_templates): se
// muestra tal cual adentro de la sección desplegable de cada IA en
// /panel-alumno/integraciones-ia, no se descarga ni se manda a nadie.
// Video tutorial embebido al principio de cada instructivo: mismo video de
// YouTube que se usa como placeholder de prueba en el resto de la
// plataforma (ver backend/src/db/seeds/001_demo_data.js, capítulos de
// curso) — el admin lo puede reemplazar por uno real propio en cualquier
// momento desde /admin-panel/ai-integraciones, es HTML como el resto del
// instructivo. El wrapper con padding-top:56.25% mantiene el video en
// proporción 16:9 sin importar el ancho del recuadro.
function videoTutorial(titulo) {
  return `
      <div style="position:relative;padding-top:56.25%;margin-bottom:14px;border-radius:8px;overflow:hidden;background:#000;">
        <iframe
          src="https://www.youtube.com/embed/dQw4w9WgXcQ"
          title="${titulo}"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
          allow="autoplay; encrypted-media; fullscreen"
          allowfullscreen
        ></iframe>
      </div>
  `;
}

const PLANTILLAS = [
  {
    clave: 'chatgpt',
    nombre: 'ChatGPT (OpenAI)',
    instructivo_html: `
      ${videoTutorial('Cómo conectar tu cuenta de ChatGPT')}
      <ol>
        <li>Entrá a <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a> e iniciá sesión (o creá una cuenta si no tenés).</li>
        <li>Hacé clic en <strong>"Create new secret key"</strong>.</li>
        <li>Copiá la key que te muestra (empieza con <code>sk-...</code>) — OpenAI solo la muestra completa esta vez, después no se puede volver a ver.</li>
        <li>Pegala acá abajo en el campo "API key" y confirmá.</li>
      </ol>
      <p><strong>Importante:</strong> para que la key funcione de verdad hace falta tener crédito cargado en <a href="https://platform.openai.com/settings/organization/billing" target="_blank" rel="noreferrer">Billing</a> de tu cuenta de OpenAI — la plataforma no cubre ese costo, corre 100% por tu cuenta.</p>
    `,
  },
  {
    clave: 'claude',
    nombre: 'Claude (Anthropic)',
    instructivo_html: `
      ${videoTutorial('Cómo conectar tu cuenta de Claude')}
      <ol>
        <li>Entrá a <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com/settings/keys</a> e iniciá sesión (o creá una cuenta si no tenés).</li>
        <li>Hacé clic en <strong>"Create Key"</strong>.</li>
        <li>Copiá la key que te muestra (empieza con <code>sk-ant-...</code>) — Anthropic solo la muestra completa esta vez.</li>
        <li>Pegala acá abajo en el campo "API key" y confirmá.</li>
      </ol>
      <p><strong>Importante:</strong> para que la key funcione de verdad hace falta tener crédito cargado en la sección Billing de tu cuenta de Anthropic — corre 100% por tu cuenta, la plataforma no lo cubre.</p>
    `,
  },
  {
    clave: 'gemini',
    nombre: 'Gemini (Google)',
    instructivo_html: `
      ${videoTutorial('Cómo conectar tu cuenta de Gemini')}
      <ol>
        <li>Entrá a <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com/app/apikey</a> con tu cuenta de Google.</li>
        <li>Hacé clic en <strong>"Create API key"</strong> y elegí (o creá) un proyecto de Google Cloud cuando te lo pida.</li>
        <li>Copiá la key que te genera.</li>
        <li>Pegala acá abajo en el campo "API key" y confirmá.</li>
      </ol>
      <p><strong>Importante:</strong> Gemini tiene una capa gratuita con límites de uso — no siempre hace falta cargar una tarjeta para empezar, pero si superás esos límites la key deja de responder hasta el mes que viene (o hasta que actives facturación).</p>
    `,
  },
];

exports.seed = async function (knex) {
  for (const plantilla of PLANTILLAS) {
    await knex('ai_integration_templates')
      .insert({ ...plantilla, activo: true })
      .onConflict('clave')
      .merge(['nombre', 'instructivo_html']);
  }
};
