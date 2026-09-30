import { useEffect, useState } from 'react';
import { api } from '../api/client';

function formatearFecha(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// "Mis alertas": historial completo de los avisos que mandó el admin (ver
// AlertaPopup.jsx para el pop-up que aparece una sola vez al entrar —
// esta pantalla es para volver a leer cualquiera de ellos después). Cada
// aviso se puede marcar "Recibido": el admin ve quién lo leyó de verdad.
export default function Alertas() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/alertas/mias', { tokenKey: 'token' })
      .then((d) => setAlertas(d.alertas))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function marcarRecibido(id) {
    try {
      await api.post(`/alertas/${id}/recibido`, {}, { tokenKey: 'token' });
      setAlertas((lista) => lista.map((a) => (a.id === id ? { ...a, recibido_en: new Date().toISOString() } : a)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="section">
      <div className="container">
        <h1>Mis alertas</h1>
        <p className="text-muted">Avisos que te mandó la administración de la escuela.</p>

        {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

        {loading ? (
          <div className="spinner-msg">Cargando…</div>
        ) : alertas.length === 0 ? (
          <p className="text-muted" style={{ marginTop: 20 }}>Todavía no tenés ningún aviso.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
            {alertas.map((a) => (
              <div key={a.id} className="card" style={{ borderLeft: a.recibido_en ? undefined : '4px solid var(--color-accent)' }}>
                <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{a.mensaje}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <p className="text-muted" style={{ margin: 0, fontSize: '0.85rem' }}>{formatearFecha(a.created_at)}</p>
                  {a.recibido_en ? (
                    <span className="badge badge-success">Recibido</span>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={() => marcarRecibido(a.id)}>Marcar como recibido</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
