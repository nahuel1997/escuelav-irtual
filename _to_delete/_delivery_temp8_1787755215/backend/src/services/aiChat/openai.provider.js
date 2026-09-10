// Motor real de ChatGPT (OpenAI) — a diferencia de agentProviders/
// (Sandbox de agentes, 100% simulado), este SÍ le pega a una IA real, con
// la API key que cargó el propio alumno (ver ai.controller.js). Sin SDK
// aparte: la Chat Completions API es simple y Node 22 ya trae fetch
// nativo — mismo criterio que payments.service.js con PayPal.
async function enviarMensaje({ apiKey, modelo, mensajes }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      messages: mensajes.map((m) => ({ role: m.rol, content: m.contenido })),
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}`);

  const data = await res.json();
  const texto = data.choices?.[0]?.message?.content;
  if (!texto) throw new Error('OpenAI no devolvió ningún texto');
  return { texto };
}

module.exports = { enviarMensaje };
