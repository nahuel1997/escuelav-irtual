import { Link } from 'react-router-dom';
import { useContent } from '../hooks/useContent';
import { API_ORIGIN } from '../api/client';

// Sección de contacto/footer con fondo oscuro, siguiendo el mismo criterio
// visual que la sección de contacto de aiviento.com (CF7 dark theme).
// Los datos de contacto son los mismos que se editan en la página de
// Contacto (misma clave en /api/content). Los links de "Navegación" fijos
// (Inicio/Tienda/Contacto/Términos) son funcionales y quedan en código; el
// admin puede sumar más desde Generales → Links de footer.
export default function Footer() {
  const { values: content, navLinks } = useContent();
  const extraFooter = navLinks.filter((l) => l.ubicacion === 'footer');
  // Sobre fondo oscuro usamos la variante clara del logo si el admin
  // cargó una en Generales; si no, caemos al logo normal (mejor que nada,
  // aunque no esté pensado para este fondo).
  const logo = content['general.logo_oscuro'] || content['general.logo'];
  const logoAlt = content['general.logo.alt'] || 'Escuela Online';

  return (
    <footer className="section-dark" style={{ padding: '48px 0 24px' }}>
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32 }}>
        <div>
          {logo ? (
            <img
              src={logo.startsWith('/uploads') ? `${API_ORIGIN}${logo}` : logo}
              alt={logoAlt}
              style={{ height: 30, display: 'block', marginBottom: 10 }}
            />
          ) : (
            <h3>Escuela Online</h3>
          )}
          <p style={{ color: '#b7c2cf' }}>
            Cursos y programas online con seguimiento personalizado: classroom, tareas y certificaciones.
          </p>
        </div>
        <div>
          <h4 style={{ fontSize: '1rem' }}>Navegación</h4>
          <p><Link to="/">Inicio</Link></p>
          <p><Link to="/tienda">Tienda de cursos</Link></p>
          <p><Link to="/contacto">Contacto</Link></p>
          <p><Link to="/terminos">Términos y condiciones</Link></p>
          {extraFooter.map((l) => (
            <p key={l.id}>
              {/^https?:\/\//.test(l.url) ? (
                <a href={l.url} target="_blank" rel="noreferrer">{l.texto}</a>
              ) : (
                <Link to={l.url}>{l.texto}</Link>
              )}
            </p>
          ))}
        </div>
        <div>
          <h4 style={{ fontSize: '1rem' }}>Contacto</h4>
          <p>{content['contacto.email']}</p>
          <p>{content['contacto.telefono']}</p>
          <p>{content['contacto.ubicacion']}</p>
        </div>
      </div>
      <div className="container" style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.12)', fontSize: '0.8rem', color: '#8b97a5' }}>
        © {new Date().getFullYear()} Escuela Online. Proyecto de ejemplo.
      </div>
    </footer>
  );
}
