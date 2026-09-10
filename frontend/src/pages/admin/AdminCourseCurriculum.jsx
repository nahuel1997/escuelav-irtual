import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import CurriculumEditor from '../../components/CurriculumEditor';

// Editor de temario del curso, DESDE el panel de administración. Reusa el
// mismo <CurriculumEditor> que ya usa el profesor en /classroom/:id — el
// login de admin pasa por el mismo /api/auth/login que el de
// alumno/profesor (ver AdminAuthContext.jsx), así que un admin ya cumple
// el chequeo "profesor dueño o admin" del backend sin cambiar nada ahí.
// Esto existe porque el profesor gestiona el temario desde su propio
// classroom, pero el admin no tiene sesión ahí (área completamente aparte,
// con su propio token) — necesitaba su propia puerta de entrada.
export default function AdminCourseCurriculum() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/courses/${id}`, { auth: false })
      .then((d) => setCourse(d.course))
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <div>
      <Link to="/admin-panel/cursos" className="text-muted" style={{ fontSize: '0.9rem' }}>← Volver a cursos</Link>
      <h1 style={{ marginTop: 8 }}>{course?.titulo || 'Contenido del curso'}</h1>
      <p className="text-muted">Unidades, capítulos, videos y archivos de utilidad de este curso.</p>
      {error && <div className="alert alert-error">{error}</div>}

      <CurriculumEditor courseId={id} />
    </div>
  );
}
