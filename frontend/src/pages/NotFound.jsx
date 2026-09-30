import { Link } from 'react-router-dom';
import { useEstadoPublico } from '../hooks/useEstadoPublico';

// 404: cualquier ruta del frontend que no matcheó ninguna página (ver
// App.jsx, path="*"). No confundir con el 404 de la API — ese es JSON y
// lo devuelve notFoundHandler en el backend. El título y el texto se
// editan en Admin → Configuración → Páginas de error.
export default function NotFound() {
  const estado = useEstadoPublico();
  const textos = estado?.paginas_error || {};
  return (
    <section className="section text-center" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="container">
        <span className="badge">Error 404</span>
        <h1 style={{ marginTop: 12 }}>{textos.titulo404 || 'No encontramos esta página'}</h1>
        <p className="text-muted">
          {textos.texto404 || 'El link puede estar mal escrito, o la página se movió. Volvé al inicio y probá de nuevo desde ahí.'}
        </p>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </section>
  );
}
