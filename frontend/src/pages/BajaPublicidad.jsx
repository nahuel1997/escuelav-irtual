import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

// Baja de publicidad (link al pie de cada campaña, sin login). Se confirma
// con un botón — no alcanza con abrir el link, porque algunos programas de
// mail abren los links solos para revisarlos.
export default function BajaPublicidad() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    api.get(`/m/baja/${encodeURIComponent(token)}`, { auth: false }).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  async function confirmar() {
    try {
      await api.post(`/m/baja/${encodeURIComponent(token)}`, {}, { auth: false });
      setListo(true);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 560 }}>
        <div className="card text-center">
          <h1 style={{ marginTop: 0 }}>Publicidad por mail</h1>
          {error && <div className="alert alert-error">{error}</div>}
          {!info && !error && <p className="text-muted">Cargando…</p>}
          {info && (listo || info.yaDadoDeBaja ? (
            <p>Listo: <strong>{info.email}</strong> ya no va a recibir publicidad. Los mails de tus compras, turnos y consultas te siguen llegando. Si cambiás de idea, lo reactivás desde tu perfil.</p>
          ) : (
            <>
              <p>¿Querés dejar de recibir novedades y promociones en <strong>{info.email}</strong>?</p>
              <button className="btn btn-primary" onClick={confirmar}>Sí, no quiero recibir más publicidad</button>
            </>
          ))}
        </div>
      </div>
    </section>
  );
}
