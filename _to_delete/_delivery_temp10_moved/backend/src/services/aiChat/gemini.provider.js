// Motor real de Gemini (Google) — misma lógica que los otros dos
// proveedores, con el formato propio de la Generative Language API: la
// key va en el query string (no en un header), los roles son 'user'/
// 'model' (no 'user'/'assistant' como los otros dos) y el texto va
// anidado en contents[].parts[].text.
//
// `sistema` (opcional, ver aiGpt.model.js): tampoco va mezclado en
// `contents` (esa lista es solo el ida-y-vuelta de la charla) — Gemini
// tiene su propio campo top-level para esto, `systemInstruction`.
async function enviarMensaje({ apiKey, modelo, mensajes, sistema }) {
  const contents = mensajes.map((m) => ({
    role: m.rol === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.contenido }],
  }));

  const body = { contents };
  if (sistema) body.systemInstruction = { parts: [{ text: sistema }] };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);

  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) throw new Error('Gemini no devolvió ningún texto');
  return { texto };
}

module.exports = { enviarMensaje };
