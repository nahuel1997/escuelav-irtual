import { Link } from 'react-router-dom';
import { ESTADO_CURSO_INFO } from '../config/estadosCurso';

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

// Se usa tanto en la grilla comprable de la tienda como en "Ya obtenidos"
// (cursos que el usuario ya tiene) — un curso "cancelado" solo puede
// aparecer en esta segunda, porque ya no es comprable (ver Store.jsx: el
// catálogo público que alimenta la grilla comprable solo trae "subido").
export default function CourseCard({ course, actions }) {
  const estadoInfo = ESTADO_CURSO_INFO[course.estado];
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {course.categoria && <span className="badge">{course.categoria}</span>}
        {estadoInfo && estadoInfo.value === 'cancelado' && (
          <span className={`badge ${estadoInfo.badge}`}>{estadoInfo.label}</span>
        )}
      </div>
      <h3 style={{ margin: '4px 0' }}>
        <Link to={`/tienda/${course.id}`}>{course.titulo}</Link>
      </h3>
      <p className="text-muted" style={{ flex: 1 }}>{course.descripcion}</p>
      <strong style={{ color: 'var(--color-primary)' }}>{formatPrecio(course.precio)}</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions}
        <Link to={`/tienda/${course.id}`} className="btn btn-black btn-sm">Ver curso</Link>
      </div>
    </div>
  );
}
