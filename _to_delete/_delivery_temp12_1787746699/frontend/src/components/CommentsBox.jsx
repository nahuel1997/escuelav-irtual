import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Caja de comentarios de un capítulo: cualquiera con acceso al classroom
// (alumno inscripto o el profesor del curso) puede comentar y ver los
// comentarios de los demás — como una mini sección de dudas debajo del
// video. Cada quien puede borrar el suyo; el profesor puede borrar
// cualquiera (moderación básica, ya validado en el backend).
export default function CommentsBox({ chapterId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  function cargar() {
    return api.get(`/classroom/chapters/${chapterId}/comments`)
      .then((d) => setComments(d.comments))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    setCargando(true);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  async function enviar(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    setEnviando(true);
    setError('');
    try {
      await api.post(`/classroom/chapters/${chapterId}/comments`, { texto });
      setTexto('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(commentId) {
    try {
      await api.delete(`/classroom/comments/${commentId}`);
      setComments((cs) => cs.filter((c) => c.id !== commentId));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h3>Comentarios</h3>
      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={enviar} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí una duda o comentario sobre este capítulo…"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="btn btn-primary btn-sm" disabled={enviando || !texto.trim()}>
          {enviando ? 'Enviando…' : 'Comentar'}
        </button>
      </form>

      {cargando && <p className="text-muted">Cargando comentarios…</p>}
      {!cargando && comments.length === 0 && <p className="text-muted">Todavía no hay comentarios en este capítulo.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {comments.map((c) => (
          <div key={c.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <strong style={{ fontSize: '0.9rem' }}>
                {c.autor_nombre} {c.autor_apellido}
                {c.autor_rol === 'profesor' && <span className="badge" style={{ marginLeft: 6 }}>Profe</span>}
              </strong>
              {(c.user_id === user.id) && (
                <button
                  onClick={() => borrar(c.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '0.8rem' }}
                >
                  Borrar
                </button>
              )}
            </div>
            <p style={{ margin: '4px 0 0' }}>{c.texto}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
