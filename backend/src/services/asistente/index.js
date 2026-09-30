// =============================================================================
// Asistente IA del panel de admin (el bot de DBA24, versión escuela).
//
// Claude con herramientas de solo lectura sobre los datos de la escuela
// (ver herramientas.js): el admin pregunta en castellano ("¿cuánto vendimos
// este mes?", "¿qué alumnos van atrasados en el curso de Excel?") y el
// asistente consulta lo que haga falta y responde.
//
// - SDK oficial (@anthropic-ai/sdk). La clave va en ANTHROPIC_API_KEY; el
//   modelo en ASISTENTE_MODELO (por defecto claude-opus-5-5) y el esfuerzo
//   en ASISTENTE_ESFUERZO (low | medium | high; por defecto medium).
// - Ante un rechazo del modelo por sus filtros de seguridad, la API
//   reintenta sola con el modelo de respaldo recomendado
//   (fallbacks: "default").
// - El historial se guarda completo y solo se le agregan mensajes al final
//   (nunca se edita), para que el razonamiento previo siga siendo válido.
// - Los datos que devuelven las herramientas se mandan a la API de
//   Anthropic para que el modelo pueda responder.
// =============================================================================
const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const db = require('../../config/db');
const herramientas = require('./herramientas');
const { AppError } = require('../../middlewares/error.middleware');

const MODELO = process.env.ASISTENTE_MODELO || 'claude-opus-5-5';
const ESFUERZO = ['low', 'medium', 'high'].includes(process.env.ASISTENTE_ESFUERZO) ? process.env.ASISTENTE_ESFUERZO : 'medium';
const MAX_VUELTAS = 8;

const SISTEMA = `Sos el asistente del panel de administración de Escuela Online, una plataforma de cursos online con alumnos, profesores, clases en vivo, turnos, pagos, tickets de soporte y campañas de marketing.

Respondés preguntas del equipo administrador sobre los datos de la escuela usando las herramientas disponibles, que son de solo lectura: no podés crear, modificar ni borrar nada. Si te piden un cambio, explicá en qué pantalla del panel se hace.

Basá cada número en lo que devuelven las herramientas y no inventes datos; si una herramienta no alcanza para responder, decilo. Las fechas de las herramientas están en UTC y la escuela opera en hora de Argentina. Respondé en castellano rioplatense, claro y breve, con listas o tablas cortas cuando ayuden.`;

let clienteInyectado = null;

// Para los tests: un cliente falso con la misma forma (beta.messages.create).
function setCliente(c) {
  clienteInyectado = c;
}

function cliente() {
  if (clienteInyectado) return clienteInyectado;
  if (!process.env.ANTHROPIC_API_KEY) {
    const err = new AppError('El asistente no está configurado: falta ANTHROPIC_API_KEY en el .env del servidor.', 503);
    err.codigo = 'ASISTENTE_NO_CONFIGURADO';
    throw err;
  }
  return new Anthropic();
}

function textoFinal(content) {
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n').trim();
}

// Una pregunta del admin: agrega el mensaje, corre el bucle de herramientas
// y guarda todo. Devuelve la respuesta y qué herramientas usó.
async function preguntar({ adminId, conversacionId, mensaje }) {
  const texto = String(mensaje || '').trim();
  if (!texto) throw new AppError('Escribí una pregunta', 400);
  if (texto.length > 4000) throw new AppError('La pregunta es demasiado larga', 400);

  let conv = null;
  if (conversacionId) {
    conv = await db('asistente_conversaciones').where({ id: conversacionId, admin_id: adminId }).first();
    if (!conv) throw new AppError('Conversación no encontrada', 404);
  }
  const messages = conv ? JSON.parse(conv.mensajes) : [];
  messages.push({ role: 'user', content: texto });

  const api = cliente();
  const usadas = [];
  let tokensEntrada = 0;
  let tokensSalida = 0;
  let respuesta = '';
  let aviso = null;

  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta += 1) {
    let msg;
    try {
      msg = await api.beta.messages.create({
        model: MODELO,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: ESFUERZO },
        system: SISTEMA,
        tools: herramientas.DEFINICIONES,
        messages,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (Anthropic.AuthenticationError && err instanceof Anthropic.AuthenticationError) throw new AppError('La clave de Anthropic (ANTHROPIC_API_KEY) no es válida.', 503);
      if (Anthropic.RateLimitError && err instanceof Anthropic.RateLimitError) throw new AppError('El asistente está recibiendo muchas consultas. Probá en un minuto.', 429);
      if (Anthropic.APIError && err instanceof Anthropic.APIError) {
        console.error('[asistente] error de la API:', err.status, err.message);
        throw new AppError('El asistente no pudo responder ahora. Probá de nuevo en un rato.', 502);
      }
      throw err;
    }
    tokensEntrada += (msg.usage && msg.usage.input_tokens) || 0;
    tokensSalida += (msg.usage && msg.usage.output_tokens) || 0;

    // Siempre se agrega la respuesta completa (razonamiento incluido).
    messages.push({ role: 'assistant', content: msg.content });

    if (msg.stop_reason === 'refusal') {
      aviso = 'El modelo no quiso responder esta consulta.';
      break;
    }
    if (msg.stop_reason === 'pause_turn') continue;

    const usos = msg.content.filter((b) => b.type === 'tool_use');
    if (msg.stop_reason !== 'tool_use' || !usos.length) {
      respuesta = textoFinal(msg.content);
      if (msg.stop_reason === 'max_tokens') aviso = 'La respuesta quedó cortada por largo.';
      break;
    }

    // Todas las herramientas pedidas en esta vuelta, en paralelo, y todos
    // los resultados juntos en un solo mensaje.
    const resultados = await Promise.all(usos.map(async (u) => {
      usadas.push(u.name);
      const r = await herramientas.ejecutar(u.name, u.input);
      return { type: 'tool_result', tool_use_id: u.id, content: r.contenido, ...(r.error ? { is_error: true } : {}) };
    }));
    messages.push({ role: 'user', content: resultados });

    if (vuelta === MAX_VUELTAS - 1) aviso = 'La consulta necesitó demasiados pasos; probá hacerla más concreta.';
  }

  const titulo = conv ? conv.titulo : texto.slice(0, 120);
  const fila = {
    mensajes: JSON.stringify(messages),
    tokens_entrada: (conv ? conv.tokens_entrada : 0) + tokensEntrada,
    tokens_salida: (conv ? conv.tokens_salida : 0) + tokensSalida,
    updated_at: db.fn.now(),
  };
  let id = conv && conv.id;
  if (conv) await db('asistente_conversaciones').where({ id }).update(fila);
  else {
    const r = await db('asistente_conversaciones').insert({ ...fila, admin_id: adminId, titulo });
    id = typeof r[0] === 'object' ? r[0].id : r[0];
  }
  return { conversacionId: id, respuesta, aviso, herramientas: [...new Set(usadas)] };
}

function listar(adminId) {
  return db('asistente_conversaciones').where({ admin_id: adminId }).select('id', 'titulo', 'tokens_entrada', 'tokens_salida', 'created_at', 'updated_at').orderBy('updated_at', 'desc').limit(50);
}

// Para mostrar una conversación: solo los textos del admin y del asistente
// (los bloques internos de herramientas y razonamiento no se muestran).
async function ver(adminId, id) {
  const c = await db('asistente_conversaciones').where({ id, admin_id: adminId }).first();
  if (!c) throw new AppError('Conversación no encontrada', 404);
  const mensajes = [];
  for (const m of JSON.parse(c.mensajes)) {
    if (m.role === 'user' && typeof m.content === 'string') mensajes.push({ rol: 'admin', texto: m.content });
    else if (m.role === 'assistant') {
      const t = textoFinal(m.content);
      if (t) mensajes.push({ rol: 'asistente', texto: t });
    }
  }
  return { id: c.id, titulo: c.titulo, mensajes };
}

async function borrar(adminId, id) {
  await db('asistente_conversaciones').where({ id, admin_id: adminId }).del();
}

module.exports = { preguntar, listar, ver, borrar, setCliente, MODELO };
