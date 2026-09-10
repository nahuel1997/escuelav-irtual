import { useEffect, useRef, useState } from 'react';

// Chat en vivo de la sala de una clase — mismo look & feel que
// ChatWidget.jsx (chat de soporte) pero embebido en la sala en vez de
// flotante, y sobre el socket de clases en vivo en vez del de soporte
// (ver realtime/liveClassSocket.js). El socket ya conectado y el
// historial ya cargado se los pasa LiveClassRoom.jsx — este componente
// solo se encarga de mostrar los mensajes y mandar los nuevos.
export default function LiveClassChat({ socket, conectado, liveClassId, mensajesIniciales, propioUserId }) {
  const [mensajes, setMensajes] = useState(mensajesIniciales);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const listaRef = useRef(null);

  useEffect(() => {
    setMensajes(mensajesIniciales);
  }, [mensajesIniciales]);

  useEffect(() => {
    if (!socket) return undefined;

    function alLlegarMensaje(payload) {
      if (payload.liveClassId !== liveClassId) return;
      setMensajes((prev) => (prev.some((m) => m.id === payload.mensaje.id) ? prev : [...prev, payload.mensaje]));
    }

    socket.on('claseEnVivo:mensaje-nuevo', alLlegarMensaje);
    return () => socket.off('claseEnVivo:mensaje-nuevo', alLlegarMensaje);
  }, [socket, liveClassId]);

  useEffect(() => {
    if (listaRef.current) listaRef.current.scrollTop = listaRef.current.scrollHeight;
  }, [mensajes]);

  function enviar(e) {
    e.preventDefault();
    const textoLimpio = texto.trim();
    if (!textoLimpio || !socket) return;
    setEnviando(true);
    setError('');
    socket.emit('claseEnVivo:mensaje', { liveClassId, texto: textoLimpio }, (respuesta) => {
      setEnviando(false);
      if (!respuesta?.ok) {
        setError(respuesta?.error || 'No se pudo mandar el mensaje. Probá de nuevo.');
        return;
      }
      setTexto('');
    });
  }

  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ fontSize: '0.95rem' }}>Chat de la clase</strong>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted, #777)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: conectado ? '#4ade80' : '#f0a03c', display: 'inline-block' }} />
          {conectado ? 'En línea' : 'Conectando…'}
        </span>
      </div>

      <div ref={listaRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {mensajes.length === 0 && (
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>Todavía no hay mensajes. ¡Arrancá la conversación!</p>
        )}
        {mensajes.map((m) => {
          const propio = m.user_id === propioUserId;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: propio ? 'flex-end' : 'flex-start',
                background: propio ? 'var(--color-primary)' : 'var(--color-bg-alt)',
                color: propio ? '#fff' : 'var(--color-text)',
                padding: '8px 12px',
                borderRadius: 12,
                maxWidth: '85%',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              {!propio && (
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: 2 }}>
                  {m.remitente_nombre} {m.remitente_apellido}
                </div>
              )}
              {m.cuerpo}
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.78rem', margin: '0 14px 8px' }}>{error}</p>}

      <form onSubmit={enviar} style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--color-border)' }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí tu mensaje…"
          style={{ flex: 1, minWidth: 0, padding: '9px 12px', border: '1.5px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'inherit' }}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={enviando || !texto.trim() || !conectado}>
          Enviar
        </button>
      </form>
    </div>
  );
}
