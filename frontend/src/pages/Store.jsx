import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import CourseCard from '../components/CourseCard';
import PagoBanner from '../components/PagoBanner';
import { useContent } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Tienda de cursos: catálogo público, no requiere estar logueado para
// verlo (solo para comprar/inscribirse o agregar al carrito, eso se
// resuelve acá mismo y en CourseDetail). Cada tarjeta de curso es dinámica
// (una por curso), así que no tiene un botón fijo asignable desde
// "Opciones de botón" — solo título/subtítulo/color de fondo y SEO son
// editables acá.
export default function Store() {
  const { values: content } = useContent();
  useSeo(content, 'tienda', 'Tienda de cursos');
  const { user } = useAuth();
  const { items, agregar } = useCart();

  const [courses, setCourses] = useState([]);
  const [misCursos, setMisCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agregando, setAgregando] = useState(null);

  useEffect(() => {
    // El catálogo (/courses) es público y no distingue "ya lo tenés" — ese
    // dato sale de /courses/mine (requiere login). Se piden en paralelo;
    // si /courses/mine falla o no hay usuario, la tienda sigue mostrando
    // el catálogo entero igual (mismo criterio "best effort" del resto de
    // la app).
    Promise.all([
      api.get('/courses', { auth: false }),
      user ? api.get('/courses/mine').catch(() => ({ courses: [] })) : Promise.resolve({ courses: [] }),
    ])
      .then(([todos, mios]) => {
        setCourses(todos.courses);
        setMisCursos(mios.courses);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const misCursosIds = new Set(misCursos.map((c) => c.id));
  const disponibles = courses.filter((c) => !misCursosIds.has(c.id));

  async function handleAgregar(courseId) {
    setAgregando(courseId);
    try {
      await agregar(courseId);
    } catch (_e) {
      // El error más común (curso ya inscripto) ya se explica solo en
      // CourseDetail; acá alcanza con no romper la grilla.
    } finally {
      setAgregando(null);
    }
  }

  return (
    <section className="section" style={{ background: content['tienda.color_fondo'] || undefined }}>
      <div className="container">
        <h1>{content['tienda.titulo']}</h1>
        <p className="text-muted">{content['tienda.subtitulo']}</p>

        <PagoBanner />

        {loading && <div className="spinner-msg">Cargando cursos…</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          <>
            <div className="grid grid-3" style={{ marginTop: 24 }}>
              {disponibles.map((c) => {
                const enCarrito = items.some((i) => i.id === c.id);
                return (
                  <CourseCard
                    key={c.id}
                    course={c}
                    actions={
                      !user ? (
                        <Link to="/ingresar" className="btn btn-outline btn-sm">Ingresá para comprar</Link>
                      ) : user.rol !== 'profesor' && (
                        <button
                          className="btn btn-outline btn-sm"
                          disabled={enCarrito || agregando === c.id}
                          onClick={() => handleAgregar(c.id)}
                        >
                          {enCarrito ? 'En el carrito' : agregando === c.id ? 'Agregando…' : 'Agregar al carrito'}
                        </button>
                      )
                    }
                  />
                );
              })}
              {courses.length === 0 && <p className="text-muted">Todavía no hay cursos publicados.</p>}
              {courses.length > 0 && disponibles.length === 0 && (
                <p className="text-muted">Ya tenés todos los cursos publicados — mirá "Ya obtenidos" más abajo.</p>
              )}
            </div>

            {/* Cursos en los que el usuario ya está inscripto: aparte del
                catálogo comprable, para que no aparezcan mezclados con
                "Agregar al carrito" (no tendría sentido volver a comprar
                algo que ya tenés). */}
            {misCursos.length > 0 && (
              <>
                <h2 style={{ marginTop: 48 }}>Ya obtenidos</h2>
                <div className="grid grid-3" style={{ marginTop: 16 }}>
                  {misCursos.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      actions={
                        <Link to={`/classroom/${c.id}`} className="btn btn-primary btn-sm">Ir al classroom</Link>
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
