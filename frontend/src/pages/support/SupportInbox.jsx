import { useEffect, useRef, useState } from 'react';
import { useChatSocket } from '../../hooks/useChatSocket';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

// Bandeja del panel de soporte: lista de conversaciones a la izquierda,
// la conversación elegida (mensajes en vivo) a la derecha — mismo
// patrón maestro-detalle que ListasTab.jsx del backoffice de mails.
//
// Cola compartida (decisión tomada de entrada): TODOS los agentes de
// soporte ven la misma lista y pueden responder cualquier chat abierto,
// no hay asignación exclusiva. "atendido_por" en cada fila es solo
// informativo (el último agente que respondió), no bloquea a los demás.
export default function SupportInbox() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('soporte_token') : null;
  const { socket, conectado } = useChatSocket(token);

  const [tab, setTab] = useState('abierto');
  const [conversaciones, setConversaciones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [seleccionada, setSeleccionada] = useState(null);

  function cargarLista(estado) {
    setCargandoLista(true);
    return api.get(`/soporte/conversaciones?estado=${estado}`, { tokenKey: 'soporte_token' })
      .then((d) => setConversaciones(d.conversaciones))
      .catch(() => {})
      .finally(() => setCargandoLista(false));
  }

  useEffect(() => { cargarLista(tab); }, [tab]);

  // Actualiza la lista en vivo con cualquier actividad nueva (mensaje o
  // cierre), sin esperar a que el agente refresque la pantalla — así se
  // nota al toque cuando llega un chat nuevo o alguien más lo atendió.
  useEffect(() => {
    if (!socket) return undefined;

    function alLlegarMensaje() {
      cargarLista(tab);
    }
    function alCerrarse(payload) {
      if (tab === 'abierto') {
        setConversaciones((prev) => prev.filter((c) => c.id !== payload.conversationId));
      } else {
        cargarLista(tab);
      }
    }

    socket.on('chat:mensaje-nuevo', alLlegarMensaje);
    socket.on('chat:cerrado', alCerrarse);
    return () => {
      socket.off('chat:mensaje-nuevo', alLlegarMensaje);
      socket.off('chat:cerrado', alCerrarse);
    };
  }, [socket, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', gap: 20, width: '100%', minHeight: 0 }}>
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button className={`btn btn-sm ${tab === 'abierto' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('abierto')}>Abiertos</button>
          <button className={`btn btn-sm ${tab === 'cerrado' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('cerrado')}>Cerrados</button>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: conectado ? '#1a8a4a' : '#e0972d', alignSelf: 'center' }}>
            {conectado ? '● en línea' : '● conectando…'}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cargandoLista && <div className="spinner-msg">Cargando…</div>}
          {!cargandoLista && conversaciones.length === 0 && (
            <p className="text-muted" style={{ fontSize: '0.85rem' }}>
              {tab === 'abierto' ? 'No hay chats abiertos por ahora.' : 'Todavía no hay chats cerrados.'}
            </p>
          )}
          {conversaciones.map((c) => (
            <button
              key={c.id}
              className="card"
              onClick={() => setSeleccionada(c.id)}
              style={{
                textAlign: 'left', cursor: 'pointer', padding: '10px 12px',
                border: seleccionada === c.id ? '2px solid var(--color-primary)' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.88rem' }}>{c.usuario_nombre} {c.usuario_apellido}</strong>
                <span className="badge" style={{ fontSize: '0.68rem' }}>{c.usuario_rol}</span>
              </div>
              <div className="text-muted" style={{ fontSize: '0.75rem' }}>{c.usuario_email}</div>
              <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>{Number(c.cantidad_mensajes)} mensaje(s)</span>
                <span>{formatFecha(c.updated_at, { year: undefined })}</span>
              </div>
              {c.atendido_por_id && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', marginTop: 2 }}>
                  Atendido por {c.atendido_por_nombre}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex' }}>
        {seleccionada ? (
          <ConversacionActiva
            key={seleccionada}
            conversationId={seleccionada}
            socket={socket}
            onCerrada={() => cargarLista(tab)}
          />
        ) : (
          <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p className="text-muted">Elegí un chat de la lista para ver la conversación.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversacionActiva({ conversationId, socket, onCerrada }) {
  const [conversacion, setConversacion] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');
  const listaRef = useRef(null);

  useEffect(() => {
    setCargando(true);
    api.get(`/soporte/conversaciones/${conversationId}/mensajes`, { tokenKey: 'soporte_token' })
      .then((d) => { setConversacion(d.conversacion); setMensajes(d.mensajes); })
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [conversationId]);

  useEffect(() => {
    if (!socket) return undefined;
    socket.emit('chat:unirse', conversationId);

    function alLlegarMensaje(payload) {
      if (payload.conversationId !== conversationId) return; // es de otro chat de la cola compartida
      setMensajes((prev) => (prev.some((m) => m.id === payload.mensaje.id) ? prev : [...prev, payload.mensaje]));
    }
    function alCerrarse(payload) {
      if (payload.conversationId !== conversationId) return;
      setConversacion((prev) => (prev ? { ...prev, estado: 'cerrado' } : prev));
    }

    socket.on('chat:mensaje-nuevo', alLlegarMensaje);
    socket.on('chat:cerrado', alCerrarse);
    return () => {
      socket.off('chat:mensaje-nuevo', alLlegarMensaje);
      socket.off('chat:cerrado', alCerrarse);
    };
  }, [socket, conversationId]);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes]);

  async function enviar(e) {
    e.preventDefault();
    const textoLimpio = texto.trim();
    if (!textoLimpio || !socket) return;
    setEnviando(true);
    setError('');
    socket.emit('chat:mensaje', { conversationId, texto: textoLimpio }, (respuesta) => {
      setEnviando(false);
      if (!respuesta?.ok) {
        setError(respuesta?.error || 'No se pudo mandar el mensaje.');
        return;
      }
      setTexto('');
    });
  }

  function cerrarChat() {
    if (!socket) return;
    setCerrando(true);
    socket.emit('chat:cerrar', conversationId, (respuesta) => {
      setCerrando(false);
      if (!respuesta?.ok) {
        setError(respuesta?.error || 'No se pudo cerrar el chat.');
        return;
      }
      onCerrada();
    });
  }

  const chatCerrado = conversacion?.estado === 'cerrado';

  if (cargando) return <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner-msg">Cargando…</div></div>;

  return (
    <div className="card" style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong>{conversacion?.usuario_nombre || ''} {conversacion?.usuario_apellido || ''}</strong>
          <div className="text-muted" style={{ fontSize: '0.78rem' }}>{conversacion?.usuario_email}</div>
        </div>
        {!chatCerrado && (
          <button className="btn btn-outline btn-sm" onClick={cerrarChat} disabled={cerrando}>
            {cerrando ? 'Cerrando…' : 'Cerrar chat'}
          </button>
        )}
        {chatCerrado && <span className="badge">Cerrado</span>}
      </div>

      <div ref={listaRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {mensajes.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.remitente_tipo === 'soporte' ? 'flex-end' : 'flex-start',
              background: m.remitente_tipo === 'soporte' ? 'var(--color-primary)' : 'var(--color-bg-alt)',
              color: m.remitente_tipo === 'soporte' ? '#fff' : 'var(--color-text)',
              padding: '9px 14px',
              borderRadius: 12,
              maxWidth: '70%',
              fontSize: '0.88rem',
              lineHeight: 1.4,
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, marginBottom: 2, opacity: 0.8 }}>{m.remitente_nombre}</div>
            {m.cuerpo}
          </div>
        ))}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', margin: '0 18px 8px' }}>{error}</p>}

      {!chatCerrado ? (
        <form onSubmit={enviar} style={{ display: 'flex', gap: 10, padding: 14, borderTop: '1px solid var(--color-border)' }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí tu respuesta…"
            style={{ flex: 1, padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: '0.9rem', fontFamily: 'inherit' }}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={enviando || !texto.trim()}>Enviar</button>
        </form>
      ) : (
        <p className="text-muted" style={{ padding: '12px 18px', fontSize: '0.8rem', margin: 0 }}>
          Esta conversación está cerrada.
        </p>
      )}
    </div>
  );
}
