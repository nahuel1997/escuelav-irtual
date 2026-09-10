import { Link } from 'react-router-dom';

// 404: cualquier ruta del frontend que no matcheó ninguna página (ver
// App.jsx, path="*"). No confundir con el 404 de la API — ese es JSON y
// lo devuelve notFoundHandler en el backend.
export default function NotFound() {
  return (
    <section className="section text-center" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center' }}>
      <div className="container">
        <span className="badge">Error 404</span>
        <h1 style={{ marginTop: 12 }}>No encontramos esta página</h1>
        <p className="text-muted">
          El link puede estar mal escrito, o la página se movió. Volvé al inicio y probá de nuevo desde ahí.
        </p>
        <Link to="/" className="btn btn-primary">Volver al inicio</Link>
      </div>
    </section>
  );
}
