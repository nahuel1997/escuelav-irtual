// Motor real de ChatGPT (OpenAI) — a diferencia de agentProviders/
// (Sandbox de agentes, 100% simulado), este SÍ le pega a una IA real, con
// la API key que cargó el propio alumno (ver ai.controller.js). Sin SDK
// aparte: la Chat Completions API es simple y Node 22 ya trae fetch
// nativo — mismo criterio que payments.service.js con PayPal.
//
// `sistema` (opcional): cuando la conversación nace de un GPT propio del
// alumno (ver aiGpt.model.js), va como un mensaje más con role "system"
// AL PRINCIPIO — así es como OpenAI espera instrucciones de sistema en la
// Chat Completions API (a diferencia de Anthropic/Gemini, que usan un
// campo separado, ver los otros dos providers).
async function enviarMensaje({ apiKey, modelo, mensajes, sistema }) {
  const historial = mensajes.map((m) => ({ role: m.rol, content: m.contenido }));
  const messages = sistema ? [{ role: 'system', content: sistema }, ...historial] : historial;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, messages }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}`);

  const data = await res.json();
  const texto = data.choices?.[0]?.message?.content;
  if (!texto) throw new Error('OpenAI no devolvió ningún texto');
  return { texto };
}

module.exports = { enviarMensaje };
