// Motor real de Claude (Anthropic) — misma lógica que openai.provider.js,
// con el formato propio de la Messages API de Anthropic (header
// "x-api-key" en vez de Authorization Bearer, y la respuesta viene en
// content[0].text en vez de choices[0].message.content).
//
// `sistema` (opcional, ver aiGpt.model.js): a diferencia de OpenAI,
// Anthropic NO acepta un mensaje con role "system" dentro de `messages`
// (esa API solo admite user/assistant alternados) — el system prompt va
// en un campo top-level aparte, `system`.
async function enviarMensaje({ apiKey, modelo, mensajes, sistema }) {
  const body = {
    model: modelo,
    max_tokens: 1024,
    messages: mensajes.map((m) => ({ role: m.rol, content: m.contenido })),
  };
  if (sistema) body.system = sistema;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Anthropic respondió ${res.status}`);

  const data = await res.json();
  const texto = data.content?.[0]?.text;
  if (!texto) throw new Error('Claude no devolvió ningún texto');
  return { texto };
}

module.exports = { enviarMensaje };
