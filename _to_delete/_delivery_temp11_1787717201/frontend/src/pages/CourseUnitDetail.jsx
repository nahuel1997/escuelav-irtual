import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChapterTimeline from '../components/ChapterTimeline';
import CourseSidebar from '../components/CourseSidebar';

// Página de detalle de una unidad ("tema"): introducción + qué se va a
// ver, y la línea de tiempo de sus capítulos con el estado de bloqueo de
// cada uno. Es la parada intermedia antes de entrar a mirar el primer
// capítulo (ver CourseChapter.jsx).
export default function CourseUnitDetail() {
  const { courseId, unitId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/classroom/units/${unitId}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [unitId]);

  if (loading) return <div className="spinner-msg">Cargando unidad…</div>;
  if (error) return <div className="container section"><div className="alert alert-error">{error}</div></div>;

  const { unit, capitulos, porcentaje_unidad: porcentajeUnidad } = data;
  const basePath = `/classroom/${courseId}/unidades/${unitId}/capitulos/`;
  const primerDisponible = capitulos.find((c) => c.desbloqueado && !c.completado) || capitulos.find((c) => c.desbloqueado);

  return (
    <section className="section">
      <div className="container">
      <div className="classroom-layout">
        <CourseSidebar courseId={courseId} currentUnitId={unitId} />
        <div className="classroom-main">
        <Link to={`/classroom/${courseId}`} className="text-muted" style={{ fontSize: '0.9rem' }}>← Volver al curso</Link>

        <span className="badge" style={{ marginTop: 12 }}>Unidad</span>
        <h1>{unit.titulo}</h1>

        {unit.introduccion && <p style={{ fontSize: '1.05rem' }}>{unit.introduccion}</p>}

        {unit.contenido && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Qué vas a ver en esta unidad</h3>
            <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{unit.contenido}</p>
          </div>
        )}

        <div className="card" style={{ marginTop: 24 }}>
          <h3>Capítulos</h3>
          <ChapterTimeline capitulos={capitulos} basePath={basePath} porcentaje={porcentajeUnidad} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
            {capitulos.map((cap, i) => (
              cap.desbloqueado ? (
                <Link key={cap.id} to={`${basePath}${cap.id}`} className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{cap.completado ? '✓' : i + 1}.</span>
                  <span>{cap.titulo}</span>
                  {cap.completado && <span className="badge badge-success" style={{ marginLeft: 'auto' }}>Visto</span>}
                </Link>
              ) : (
                <div key={cap.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.5 }}>
                  <span>🔒</span>
                  <span>{cap.titulo}</span>
                </div>
              )
            ))}
          </div>

          {primerDisponible && (
            <Link to={`${basePath}${primerDisponible.id}`} className="btn btn-primary" style={{ marginTop: 20 }}>
              {porcentajeUnidad > 0 ? 'Continuar' : 'Empezar'}
            </Link>
          )}
        </div>
        </div>
      </div>
      </div>
    </section>
  );
}
