import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Icon from './Icon';

// Barra lateral de navegación del curso: título del curso arriba y, abajo,
// el temario completo (unidades + capítulos), con el capítulo/unidad
// actual resaltado. Vive en las páginas de unidad y de capítulo
// (CourseUnitDetail.jsx / CourseChapter.jsx), que antes dejaban una
// columna en blanco a la izquierda del contenido centrado — ahora esa
// columna es esta navegación, para poder saltar a cualquier capítulo ya
// desbloqueado sin tener que volver atrás cada vez.
//
// Es solo navegación: el desbloqueo real (qué capítulo se puede ver o no)
// sigue viniendo del backend en /classroom/courses/:id/curriculum, igual
// que en CurriculumOverview.jsx — acá no se recalcula nada, si el backend
// dice "desbloqueado: false" el capítulo se muestra pero no es clickeable.
export default function CourseSidebar({ courseId, currentUnitId, currentChapterId }) {
  const [course, setCourse] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      api.get(`/courses/${courseId}`, { auth: false }),
      api.get(`/classroom/courses/${courseId}/curriculum`),
    ])
      .then(([c, cur]) => {
        if (cancelado) return;
        setCourse(c.course);
        setData(cur);
      })
      .catch(() => {
        // La barra es un plus de navegación, no algo crítico para poder ver
        // el capítulo: si falla, simplemente no se muestra.
      });
    return () => { cancelado = true; };
  }, [courseId]);

  if (!course || !data || data.unidades.length === 0) return null;

  const unitIdNum = Number(currentUnitId);
  const chapterIdNum = Number(currentChapterId);

  return (
    <aside className="classroom-sidebar">
      <Link to={`/classroom/${courseId}`} className="text-muted" style={{ fontSize: '0.85rem' }}>← Volver al curso</Link>
      <h3 style={{ marginTop: 8, marginBottom: 18, fontSize: '1.05rem' }}>{course.titulo}</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {data.unidades.map((unit, ui) => (
          <div key={unit.id}>
            <Link
              to={`/classroom/${courseId}/unidades/${unit.id}`}
              style={{
                display: 'block',
                fontWeight: 700,
                fontSize: '0.88rem',
                color: unit.id === unitIdNum ? 'var(--color-primary)' : 'var(--color-text)',
                marginBottom: 6,
              }}
            >
              {ui + 1}. {unit.titulo}
            </Link>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {unit.capitulos.map((cap, ci) => {
                const activo = cap.id === chapterIdNum;
                const contenido = (
                  <>
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {cap.completado ? <Icon name="check" size={13} strokeWidth={2.5} /> : cap.desbloqueado ? `${ci + 1}.` : <Icon name="lock" size={12} />}
                    </span>
                    <span>{cap.titulo}</span>
                  </>
                );
                const estiloComun = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  marginLeft: 8,
                  borderRadius: 6,
                  fontSize: '0.84rem',
                  fontWeight: activo ? 700 : 400,
                };
                return cap.desbloqueado ? (
                  <Link
                    key={cap.id}
                    to={`/classroom/${courseId}/unidades/${unit.id}/capitulos/${cap.id}`}
                    style={{ ...estiloComun, background: activo ? 'var(--color-bg-alt)' : 'transparent', color: 'var(--color-text)' }}
                  >
                    {contenido}
                  </Link>
                ) : (
                  <span key={cap.id} style={{ ...estiloComun, color: 'var(--color-text-muted)', opacity: 0.65 }}>
                    {contenido}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
