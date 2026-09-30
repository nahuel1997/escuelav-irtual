import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ESTADO_CURSO_INFO } from '../config/estadosCurso';
import PagoBanner from '../components/PagoBanner';
import BotonPdfProceso from '../components/BotonPdfProceso';

// Para un alumno: cursos en los que está inscripto (viene de /courses/mine).
// Para un profesor: cursos que dicta (viene de /courses filtrando por él,
// ya que /courses/mine es semánticamente "en los que estoy inscripto"; un
// profesor puede además estar inscripto como alumno en otros cursos).
export default function MyCourses() {
  const { user } = useAuth();
  const [inscripto, setInscripto] = useState([]);
  const [dictando, setDictando] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const mios = await api.get('/courses/mine');
        setInscripto(mios.courses);
        if (user.rol === 'profesor') {
          // Antes filtraba /courses (el catálogo público), pero ese ahora
          // solo trae cursos "subido" — un curso en revisión/cancelado/
          // fuera de sistema del propio profesor desaparecía de acá. Este
          // endpoint le trae los suyos sin importar el estado.
          const propios = await api.get('/courses/teaching');
          setDictando(propios.courses);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  return (
    <section className="section">
      <div className="container">
        <h1>Mis cursos</h1>
        {/* Avance en PDF (alumno: el suyo; profesor: el de sus alumnos), en segundo plano. */}
        <div style={{ margin: '8px 0 16px' }}>
          <BotonPdfProceso tipo="mi_progreso" etiqueta={user?.rol === 'profesor' ? 'Avance de mis alumnos (PDF)' : 'Mi progreso (PDF)'} />
        </div>
        <PagoBanner />
        {error && <div className="alert alert-error">{error}</div>}

        {user.rol === 'profesor' && (
          <>
            <h3 style={{ marginTop: 24 }}>Cursos que dictás</h3>
            <div className="grid grid-3">
              {dictando.map((c) => {
                const estadoInfo = ESTADO_CURSO_INFO[c.estado] || ESTADO_CURSO_INFO.subido;
                return (
                  <div key={c.id} className="card">
                    <h3>{c.titulo}</h3>
                    <p className="text-muted">{c.descripcion}</p>
                    {estadoInfo.value !== 'subido' && (
                      <span className={`badge ${estadoInfo.badge}`} style={{ marginBottom: 8, display: 'inline-block' }}>{estadoInfo.label}</span>
                    )}
                    <br />
                    <Link to={`/classroom/${c.id}`} className="btn btn-primary btn-sm">Ir al classroom</Link>
                  </div>
                );
              })}
              {dictando.length === 0 && <p className="text-muted">Todavía no creaste ningún curso.</p>}
            </div>
          </>
        )}

        <h3 style={{ marginTop: 24 }}>{user.rol === 'profesor' ? 'Cursos en los que estás inscripto' : 'Cursos inscriptos'}</h3>
        <div className="grid grid-3">
          {inscripto.map((c) => (
            <div key={c.id} className="card">
              <h3>{c.titulo}</h3>
              <p className="text-muted">{c.descripcion}</p>
              <span className="badge badge-success">{c.payment_status}</span>{' '}
              {c.completado_at && <span className="badge badge-success">Completado</span>}
              <br />
              <Link to={`/classroom/${c.id}`} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>Ir al classroom</Link>
            </div>
          ))}
          {inscripto.length === 0 && (
            <p className="text-muted">
              Todavía no te inscribiste a ningún curso. <Link to="/tienda">Mirá la tienda</Link>.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
