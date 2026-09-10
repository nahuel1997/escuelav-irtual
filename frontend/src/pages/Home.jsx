import { Link } from 'react-router-dom';
import { useContent, resolveButton } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';
import { API_ORIGIN } from '../api/client';

// Home general, con la misma lógica de estructura que aiviento.com: héroe,
// bloque "sobre la escuela", 3 ejes/soluciones y un cierre con CTA a
// contacto — pero con contenido orientado a una escuela online.
//
// El texto, la imagen, el color de fondo y los botones de la portada
// salen de /api/content (editables desde /admin-panel/contenido, pestaña
// "Home"); si el admin todavía no cargó nada, se usan los valores por
// defecto definidos en src/config/content.js.
export default function Home() {
  const { values: content, buttons } = useContent();
  useSeo(content, 'home', 'Inicio');

  const heroImagen = content['home.hero.imagen'];
  const botonPrincipal = resolveButton(buttons, content, 'home.hero.boton_principal');
  const botonSecundario = resolveButton(buttons, content, 'home.hero.boton_secundario');
  const botonCta = resolveButton(buttons, content, 'home.cta.boton');

  return (
    <>
      <section className="section" style={{ paddingTop: 96, background: content['home.hero.color_fondo'] || undefined }}>
        <div className="container" style={{ maxWidth: 780 }}>
          {/* badge-accent (no badge-warning): esta etiqueta es una marca de
              marketing, no un estado "pendiente" — badge-warning es
              semántico y se reutiliza para turnos/entregas pendientes en
              Calendario y Classroom, así que si el admin cambia el color de
              acento este badge lo sigue sin afectar a los badges de estado
              real de otras pantallas. */}
          <span className="badge badge-accent">{content['home.hero.badge']}</span>
          <h1 style={{ fontSize: '2.6rem', marginTop: 16 }}>
            {content['home.hero.titulo']}
          </h1>
          <p className="text-muted" style={{ fontSize: '1.1rem' }}>
            {content['home.hero.subtitulo']}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Link
              to={botonPrincipal?.link || '/tienda'}
              className="btn btn-primary"
              style={botonPrincipal ? { background: botonPrincipal.color_fondo, color: botonPrincipal.color_texto } : undefined}
            >
              Ver cursos disponibles
            </Link>
            <Link
              to={botonSecundario?.link || '/registrarme'}
              className="btn btn-outline"
              style={botonSecundario ? { background: botonSecundario.color_fondo, color: botonSecundario.color_texto, borderColor: botonSecundario.color_fondo } : undefined}
            >
              Crear cuenta gratis
            </Link>
          </div>
          {heroImagen && (
            <img
              src={heroImagen.startsWith('/uploads') ? `${API_ORIGIN}${heroImagen}` : heroImagen}
              alt={content['general.logo.alt'] || 'Escuela Online'}
              style={{ width: '100%', maxWidth: 560, borderRadius: 12, marginTop: 32 }}
            />
          )}
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <h2>Todo lo que necesitás para estudiar online</h2>
          <div className="grid grid-3" style={{ marginTop: 32 }}>
            <div className="card">
              <h3>Classroom real</h3>
              <p className="text-muted">
                Tus profesores publican tareas, vos entregás archivos y recibís
                devolución con calificación directamente en la plataforma.
              </p>
            </div>
            <div className="card">
              <h3>Logros y progreso</h3>
              <p className="text-muted">
                Cada hito que alcanzás (tu primer curso, tu primera entrega, un
                curso completo) queda registrado como logro en tu perfil.
              </p>
            </div>
            <div className="card">
              <h3>Creador de CV</h3>
              <p className="text-muted">
                Cargá tu experiencia y estudios, sumá automáticamente tus cursos
                y logros de la plataforma, y descargá tu CV en PDF.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Cómo funciona</h2>
          <div className="grid grid-3" style={{ marginTop: 32 }}>
            <div>
              <span className="badge">Paso 1</span>
              <h3 style={{ marginTop: 12 }}>Elegís tu curso</h3>
              <p className="text-muted">Explorá la tienda y sumate al programa que te interesa.</p>
            </div>
            <div>
              <span className="badge">Paso 2</span>
              <h3 style={{ marginTop: 12 }}>Cursás en el classroom</h3>
              <p className="text-muted">Entregás tareas y recibís feedback de tu profesor.</p>
            </div>
            <div>
              <span className="badge">Paso 3</span>
              <h3 style={{ marginTop: 12 }}>Sumás logros y armás tu CV</h3>
              <p className="text-muted">Todo lo que lograste se refleja en tu perfil y en tu currículum.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-dark" style={{ padding: '64px 0' }}>
        <div className="container text-center">
          <h2>¿Listo para empezar?</h2>
          <p style={{ color: '#c3ccd6' }}>Creá tu cuenta gratis y elegí tu primer curso hoy mismo.</p>
          <Link
            to={botonCta?.link || '/registrarme'}
            className="btn btn-accent"
            style={{ marginTop: 8, ...(botonCta ? { background: botonCta.color_fondo, color: botonCta.color_texto } : {}) }}
          >
            Registrarme
          </Link>
        </div>
      </section>
    </>
  );
}
