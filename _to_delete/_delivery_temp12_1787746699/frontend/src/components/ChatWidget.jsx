import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import { api } from '../api/client';

// Chat de contacto flotante, visible en cualquier página para alumnos y
// profesores logueados (no para visitantes anónimos ni para admin/
// soporte, que tienen sus propias pantallas). Se monta desde Layout.jsx.
//
// El historial se carga por REST al abrir (GET /api/chat/mi-conversacion);
// los mensajes nuevos —los que mande este usuario y los que responda
// soporte— llegan en vivo por socket (ver hooks/useChatSocket.js). No
// hace falta "unirse" a la conversación a mano para recibirlos: el
// servidor ya manda todo lo de este usuario a su room personal apenas se
// conecta (ver realtime/chatSocket.js).
export default function ChatWidget() {
  const { user } = useAuth();
  const [abierto, setAbierto] = useState(false);
  const [cargado, setCargado] = useState(false);
  const [conversacion, setConversacion] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const listaRef = useRef(null);

  // Ojo: los hooks de acá arriba corren SIEMPRE, incluso para un visitante
  // anónimo o un admin — React exige el mismo orden de hooks en cada
  // render, así que el "if (!user...) return null" de más abajo no alcanza
  // para evitarlos. Por eso cada uno se guarda solo, chequeando el rol acá
  // adentro, en vez de asumir que nunca corren si el componente "no se
  // muestra": sin este chequeo, CUALQUIER visita anónima disparaba un GET
  // a /chat/mi-conversacion condenado a 401 (no hay usuario logueado para
  // pedirle su conversación), en cada página del sitio público.
  const puedeChatear = user && ['alumno', 'profesor'].includes(user.rol);
  const token = puedeChatear && typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const { socket, conectado } = useChatSocket(token);

  useEffect(() => {
    if (puedeChatear && !cargado) {
      api.get('/chat/mi-conversacion', { tokenKey: 'token' })
        .then((d) => { setConversacion(d.conversacion); setMensajes(d.mensajes); })
        .catch(() => {})
        .finally(() => setCargado(true));
    }
  }, [cargado, puedeChatear]);

  useEffect(() => {
    if (!socket) return undefined;

    function alLlegarMensaje(payload) {
      // Solo nos importan los mensajes de ESTA conversación (o, si
      // todavía no teníamos una, la que se acaba de crear con nuestro
      // primer mensaje — el server siempre manda esto a la room personal
      // del usuario dueño, así que si llegó acá es nuestro).
      setConversacion((prev) => (prev && prev.id === payload.conversationId ? prev : { id: payload.conversationId, estado: 'abierto' }));
      setMensajes((prev) => (prev.some((m) => m.id === payload.mensaje.id) ? prev : [...prev, payload.mensaje]));
    }
    function alCerrarse(payload) {
      setConversacion((prev) => (prev && prev.id === payload.conversationId ? { ...prev, estado: 'cerrado' } : prev));
    }

    socket.on('chat:mensaje-nuevo', alLlegarMensaje);
    socket.on('chat:cerrado', alCerrarse);
    return () => {
      socket.off('chat:mensaje-nuevo', alLlegarMensaje);
      socket.off('chat:cerrado', alCerrarse);
    };
  }, [socket]);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes, abierto]);

  if (!puedeChatear) return null;

  async function enviar(e) {
    e.preventDefault();
    const textoLimpio = texto.trim();
    if (!textoLimpio || !socket) return;
    setEnviando(true);
    setError('');
    socket.emit('chat:mensaje', { conversationId: conversacion?.id, texto: textoLimpio }, (respuesta) => {
      setEnviando(false);
      if (!respuesta?.ok) {
        setError(respuesta?.error || 'No se pudo mandar el mensaje. Probá de nuevo.');
        return;
      }
      setTexto('');
    });
  }

  const chatCerrado = conversacion?.estado === 'cerrado';

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 50, fontFamily: 'var(--font-body), sans-serif' }}>
      {abierto && (
        <div className="card" style={{ width: 340, height: 460, padding: 0, display: 'flex', flexDirection: 'column', marginBottom: 12, boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--color-primary)', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong style={{ fontSize: '0.95rem' }}>Chat con soporte</strong>
              <div style={{ fontSize: '0.72rem', opacity: 0.85, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? '#4ade80' : '#f0a03c', display: 'inline-block' }} />
                {conectado ? 'En línea' : 'Conectando…'}
              </div>
            </div>
            <button onClick={() => setAbierto(false)} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }} aria-label="Cerrar chat">×</button>
          </div>

          <div ref={listaRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!cargado && <p className="text-muted" style={{ fontSize: '0.85rem' }}>Cargando…</p>}
            {cargado && mensajes.length === 0 && (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                Contanos qué necesitás — un agente de soporte te va a responder acá mismo.
              </p>
            )}
            {mensajes.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.remitente_tipo === 'usuario' ? 'flex-end' : 'flex-start',
                  background: m.remitente_tipo === 'usuario' ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                  color: m.remitente_tipo === 'usuario' ? '#fff' : 'var(--color-text)',
                  padding: '8px 12px',
                  borderRadius: 12,
                  maxWidth: '80%',
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                }}
              >
                {m.remitente_tipo === 'soporte' && (
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 2 }}>{m.remitente_nombre}</div>
                )}
                {m.cuerpo}
              </div>
            ))}
            {chatCerrado && (
              <p className="text-muted" style={{ fontSize: '0.78rem', textAlign: 'center', margin: '4px 0' }}>
                Esta conversación fue cerrada. Escribí de nuevo para empezar una nueva.
              </p>
            )}
          </div>

          {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.78rem', margin: '0 14px 8px' }}>{error}</p>}

          <form onSubmit={enviar} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--color-border)' }}>
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí tu mensaje…"
              style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit' }}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={enviando || !texto.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: 'var(--color-accent)', color: '#fff', fontSize: '1.5rem',
          boxShadow: 'var(--shadow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Abrir chat de soporte"
        title="Chat de soporte"
      >
        {abierto ? '×' : '💬'}
      </button>
    </div>
  );
}
