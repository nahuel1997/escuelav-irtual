import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatFecha } from '../utils/fecha';

const ESTADO_LABEL = {
  programada: 'Programada',
  en_vivo: 'En vivo',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
};
const ESTADO_BADGE = {
  programada: 'badge',
  en_vivo: 'badge-success',
  finalizada: '',
  cancelada: 'badge-danger',
};

function EstadoBadge({ estado }) {
  return <span className={`badge ${ESTADO_BADGE[estado] || ''}`}>{ESTADO_LABEL[estado] || estado}</span>;
}

// Pestaña de "clase en vivo": la comparten alumno y profesor (mismo
// espíritu que Calendar.jsx), pero cada uno ve sus propias clases —
// alumno, las de los cursos en los que está inscripto; profesor, aquellas
// donde está asignado (puede haber más de uno co-dictando, ver
// liveClass.model.js) — y las acciones disponibles difieren: el profesor
// puede iniciar/finalizar la transmisión, el alumno solo entra cuando ya
// está en vivo. Agendar/editar/cancelar es exclusivo del admin (ver
// AdminLiveClasses.jsx).
export default function LiveClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clases, setClases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [iniciando, setIniciando] = useState(null);

  function cargar() {
    return api.get('/clases-en-vivo/mias').then((d) => setClases(d.clases));
  }

  useEffect(() => {
    cargar()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function iniciarYEntrar(clase) {
    setIniciando(clase.id);
    setError('');
    try {
      if (clase.estado === 'programada') {
        await api.put(`/clases-en-vivo/${clase.id}/iniciar`);
      }
      navigate(`/clases-en-vivo/${clase.id}/sala`);
    } catch (err) {
      setError(err.message);
      setIniciando(null);
    }
  }

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  const enVivo = clases.filter((c) => c.estado === 'en_vivo');
  const programadas = clases.filter((c) => c.estado === 'programada');
  const historial = clases.filter((c) => ['finalizada', 'cancelada'].includes(c.estado));

  return (
    <section className="section">
      <div className="container">
        <span className="badge">Clases en vivo</span>
        <h1>Clases en vivo</h1>
        <p className="text-muted">
          {user.rol === 'profesor'
            ? 'Las clases donde estás asignado como profesor. Iniciá la transmisión cuando estés listo para empezar.'
            : 'Las clases en vivo de tus cursos. Vas a poder entrar a la sala apenas el profesor la inicie.'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {enVivo.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3>En vivo ahora</h3>
            {enVivo.map((c) => (
              <ClaseCard key={c.id} clase={c} rol={user.rol} onEntrar={() => navigate(`/clases-en-vivo/${c.id}/sala`)} />
            ))}
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          <h3>Próximas</h3>
          {programadas.length === 0 && <p className="text-muted">No hay clases programadas por ahora.</p>}
          {programadas.map((c) => (
            <ClaseCard
              key={c.id}
              clase={c}
              rol={user.rol}
              procesando={iniciando === c.id}
              onIniciar={user.rol === 'profesor' ? () => iniciarYEntrar(c) : undefined}
            />
          ))}
        </div>

        {historial.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <h3>Historial</h3>
            {historial.map((c) => (
              <ClaseCard key={c.id} clase={c} rol={user.rol} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ClaseCard({ clase, rol, onEntrar, onIniciar, procesando }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <div>
          <strong>{clase.titulo}</strong>
          <p className="text-muted" style={{ margin: '2px 0' }}>{clase.curso_titulo}</p>
          <p style={{ margin: '4px 0' }}>{formatFecha(clase.scheduled_at)} · {clase.duracion_minutos} min</p>
          {clase.descripcion && <p className="text-muted" style={{ margin: 0 }}>{clase.descripcion}</p>}
        </div>
        <EstadoBadge estado={clase.estado} />
      </div>

      {clase.estado === 'en_vivo' && onEntrar && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onEntrar}>
          Entrar a la sala
        </button>
      )}

      {clase.estado === 'programada' && rol === 'profesor' && onIniciar && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={procesando} onClick={onIniciar}>
          {procesando ? 'Iniciando…' : 'Iniciar clase'}
        </button>
      )}

      {clase.estado === 'programada' && rol === 'alumno' && (
        <p className="text-muted" style={{ marginTop: 10, fontSize: '0.85rem' }}>
          Todavía no empezó. Vas a poder entrar apenas el profesor la inicie.
        </p>
      )}
    </div>
  );
}
