import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatFecha } from '../utils/fecha';

// Página pública de aprobación (link que llega por mail, sin login): el
// usuario aprueba o rechaza lo que le pidió el equipo en su consulta.
export default function Aprobacion() {
  const { token } = useParams();
  const [ap, setAp] = useState(null);
  const [error, setError] = useState('');
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [respuesta, setRespuesta] = useState('');

  useEffect(() => {
    api.get(`/aprobacion/${encodeURIComponent(token)}`, { auth: false })
      .then((d) => setAp(d.aprobacion))
      .catch((e) => setError(e.message));
  }, [token]);

  async function responder(decision) {
    setEnviando(true);
    setError('');
    try {
      await api.post(`/aprobacion/${encodeURIComponent(token)}`, { decision, comentario }, { auth: false });
      setRespuesta(decision);
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 640 }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Aprobación</h1>
          {error && <div className="alert alert-error">{error}</div>}
          {!ap && !error && <p className="text-muted">Cargando…</p>}
          {ap && (
            <>
              <p className="text-muted" style={{ marginTop: 0 }}>Consulta {ap.numero} · {ap.asunto}</p>
              <p>Hola {ap.nombre}, necesitamos que apruebes lo siguiente:</p>
              <div style={{ background: 'var(--color-bg-alt)', padding: 14, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{ap.detalle}</div>

              {respuesta ? (
                <div className="alert alert-success" style={{ marginTop: 16 }}>
                  ¡Listo! Registramos que {respuesta === 'aprobado' ? 'lo aprobaste' : 'lo rechazaste'}. Ya podés cerrar esta página.
                </div>
              ) : ap.estado !== 'pendiente' ? (
                <div className="alert alert-success" style={{ marginTop: 16 }}>
                  Este pedido ya fue {ap.estado === 'aprobado' ? 'aprobado' : 'rechazado'}{ap.respondido_en ? ` el ${formatFecha(ap.respondido_en)}` : ''}.
                </div>
              ) : ap.vencida ? (
                <div className="alert alert-error" style={{ marginTop: 16 }}>El link venció. Pedí uno nuevo respondiendo en tu consulta.</div>
              ) : (
                <>
                  <div className="field" style={{ marginTop: 16 }}>
                    <label>Comentario (opcional)</label>
                    <textarea rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={2000} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" disabled={enviando} onClick={() => responder('aprobado')}>Aprobar</button>
                    <button className="btn btn-danger" disabled={enviando} onClick={() => responder('rechazado')}>Rechazar</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
