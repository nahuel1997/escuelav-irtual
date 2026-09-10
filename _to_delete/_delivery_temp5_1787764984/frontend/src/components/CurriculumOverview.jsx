import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Icon from './Icon';

const ETIQUETA_MODO = {
  libre: 'Vista libre — podés mirar cualquier capítulo',
  por_unidad: 'Por unidad — arrancá cualquier unidad por su primer capítulo',
  continuo: 'Continuo — se desbloquea capítulo a capítulo, en orden',
};

// Temario del curso para el alumno (y para el profesor, como
// previsualización): lista de unidades con su % y, dentro, el estado de
// cada capítulo. Vive en Classroom.jsx como la pestaña "Contenido del
// curso", separado de la vista de tareas.
export default function CurriculumOverview({ courseId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/classroom/courses/${courseId}/curriculum`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  if (loading) return <div className="spinner-msg">Cargando temario…</div>;
  if (error) return <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>;

  const { unidades, porcentaje_curso: porcentajeCurso, modo_avance: modoAvance } = data;

  if (unidades.length === 0) {
    return <p className="text-muted" style={{ marginTop: 24 }}>El profesor todavía no publicó el temario de este curso.</p>;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span className="badge">{ETIQUETA_MODO[modoAvance] || modoAvance}</span>
        <strong>{porcentajeCurso}% del curso completado</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
        {unidades.map((unit, i) => {
          const totalCap = unit.capitulos.length;
          const disponible = unit.capitulos.some((c) => c.desbloqueado);
          return (
            <Link
              key={unit.id}
              to={`/classroom/${courseId}/unidades/${unit.id}`}
              className="card"
              style={{ display: 'block', opacity: disponible ? 1 : 0.6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ margin: 0 }}>{i + 1}. {unit.titulo}</h3>
                {!disponible && (
                  <span title="Todavía no desbloqueaste ningún capítulo de esta unidad" style={{ display: 'flex', color: 'var(--color-text-muted)' }}>
                    <Icon name="lock" size={16} />
                  </span>
                )}
              </div>
              <p className="text-muted" style={{ margin: '6px 0' }}>{totalCap} capítulo{totalCap === 1 ? '' : 's'} · {unit.porcentaje_unidad}% visto</p>
              <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-alt)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${unit.porcentaje_unidad}%`, background: 'var(--color-accent)' }} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
