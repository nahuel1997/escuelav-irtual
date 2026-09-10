import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useChatSocket } from '../hooks/useChatSocket';
import JitsiRoom from '../components/JitsiRoom';
import LiveClassChat from '../components/LiveClassChat';

// Sala de una clase en vivo: video (Jitsi) + chat, para alumno y profesor.
// El acceso ya lo validó el backend en GET /sala (ver
// liveClasses.controller.js::getSala) — acá solo mostramos lo que esa
// respuesta autorizó: si la clase no está en un estado que permita sala
// para este usuario, ese mismo pedido ya viene con 409 y mostramos el
// mensaje en vez de intentar armar nada.
export default function LiveClassRoom() {
  const { id } = useParams();
  const liveClassId = Number(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const { socket, conectado } = useChatSocket(token);

  const [sala, setSala] = useState(null);
  const [mensajes, setMensajes] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [unido, setUnido] = useState(false);

  async function cargarSala() {
    const [salaRes, mensajesRes] = await Promise.all([
      api.get(`/clases-en-vivo/${liveClassId}/sala`),
      api.get(`/clases-en-vivo/${liveClassId}/mensajes`).catch(() => ({ mensajes: [] })),
    ]);
    setSala(salaRes);
    setMensajes(mensajesRes.mensajes);
  }

  useEffect(() => {
    cargarSala()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveClassId]);

  // Se une a la room del socket apenas conecta, para recibir mensajes y
  // cambios de estado en vivo (ver realtime/liveClassSocket.js). Si el
  // socket se reconecta (por ejemplo, después de perder wifi un momento),
  // vuelve a unirse solo.
  useEffect(() => {
    if (!socket || !conectado || !sala) return undefined;
    socket.emit('claseEnVivo:unirse', liveClassId, (respuesta) => {
      setUnido(Boolean(respuesta?.ok));
      if (!respuesta?.ok) setError(respuesta?.error || 'No se pudo conectar al chat de la clase');
    });
    return () => setUnido(false);
  }, [socket, conectado, sala, liveClassId]);

  useEffect(() => {
    if (!socket) return undefined;
    function alCambiarEstado(payload) {
      if (payload.liveClassId !== liveClassId) return;
      setSala((prev) => (prev ? { ...prev, clase: { ...prev.clase, estado: payload.estado } } : prev));
    }
    socket.on('claseEnVivo:estado', alCambiarEstado);
    return () => socket.off('claseEnVivo:estado', alCambiarEstado);
  }, [socket, liveClassId]);

  async function iniciar() {
    setProcesando(true);
    setError('');
    try {
      await api.put(`/clases-en-vivo/${liveClassId}/iniciar`);
      await cargarSala();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  async function finalizar() {
    setProcesando(true);
    setError('');
    try {
      await api.put(`/clases-en-vivo/${liveClassId}/finalizar`);
      navigate('/clases-en-vivo');
    } catch (err) {
      setError(err.message);
      setProcesando(false);
    }
  }

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  if (error && !sala) {
    return (
      <section className="section">
        <div className="container">
          <div className="alert alert-error">{error}</div>
          <Link to="/clases-en-vivo" className="btn btn-outline btn-sm" style={{ marginTop: 12 }}>
            ← Volver a clases en vivo
          </Link>
        </div>
      </section>
    );
  }

  const { clase, room_id, jitsi_domain } = sala;
  const esProfesor = user.rol === 'profesor';

  return (
    <section className="section">
      <div className="container-video">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <Link to="/clases-en-vivo" className="text-muted" style={{ fontSize: '0.85rem' }}>← Volver a clases en vivo</Link>
            <h1 style={{ margin: '4px 0 0' }}>{clase.titulo}</h1>
            <p className="text-muted" style={{ margin: '2px 0 0' }}>{clase.curso_titulo}</p>
          </div>

          {esProfesor && clase.estado === 'programada' && (
            <button className="btn btn-primary" disabled={procesando} onClick={iniciar}>
              {procesando ? 'Iniciando…' : 'Iniciar transmisión'}
            </button>
          )}
          {esProfesor && clase.estado === 'en_vivo' && (
            <button className="btn btn-outline" disabled={procesando} onClick={finalizar}>
              {procesando ? 'Finalizando…' : 'Finalizar clase'}
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {clase.estado === 'finalizada' && (
          <div className="alert alert-info">Esta clase ya finalizó.</div>
        )}
        {clase.estado === 'cancelada' && (
          <div className="alert alert-error">Esta clase fue cancelada.</div>
        )}

        {esProfesor && clase.estado === 'programada' && (
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            La clase todavía no está visible para los alumnos. Probá tu cámara y micrófono acá abajo, y arrancá cuando estés listo con "Iniciar transmisión".
          </div>
        )}

        <div className="grid grid-2" style={{ alignItems: 'stretch', gap: 20, minHeight: 480 }}>
          <div style={{ minHeight: 420 }}>
            <JitsiRoom dominio={jitsi_domain} roomId={room_id} displayName={`${user.nombre} (${esProfesor ? 'profesor' : 'alumno'})`} />
          </div>
          <div style={{ minHeight: 420 }}>
            {mensajes && (
              <LiveClassChat
                socket={unido ? socket : null}
                conectado={conectado && unido}
                liveClassId={liveClassId}
                mensajesIniciales={mensajes}
                propioUserId={user.id}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
