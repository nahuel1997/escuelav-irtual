import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useContent, resolveButton } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';
import { useMetodosPago } from '../hooks/useMetodosPago';
import MetodoPagoSelector from '../components/MetodoPagoSelector';

function formatPrecio(precio) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precio);
}

export default function CourseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { items: itemsCarrito, agregar } = useCart();
  const { metodos } = useMetodosPago();
  const navigate = useNavigate();
  const { values: content, buttons } = useContent();
  useSeo(content, 'curso', 'Curso');
  const botonComprar = resolveButton(buttons, content, 'curso.boton_comprar');
  const colorAcento = content['curso.color_acento'];

  const [course, setCourse] = useState(null);
  const [temario, setTemario] = useState([]);
  const [misCursos, setMisCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comprando, setComprando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    api.get(`/courses/${id}`, { auth: false })
      .then((d) => { setCourse(d.course); setTemario(d.temario || []); })
      .catch((e) => setError(e.message));
    if (user) {
      api.get('/courses/mine').then((d) => setMisCursos(d.courses)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id, user]);

  if (loading) return <div className="spinner-msg">Cargando…</div>;
  if (!course) return <div className="container section"><div className="alert alert-error">{error || 'Curso no encontrado'}</div></div>;

  const yaInscripto = misCursos.some((c) => c.id === Number(id));
  const enCarrito = itemsCarrito.some((i) => i.id === Number(id));
  const nombreProfesor = [course.profesor_nombre, course.profesor_apellido].filter(Boolean).join(' ');
  const cantidadCapitulos = temario.reduce((acc, u) => acc + u.capitulos.length, 0);
  // Un curso no "subido" ya no admite compras nuevas (ver
  // estadosCurso.js) — si el visitante ya lo tenía comprado, yaInscripto
  // gana igual y ve el flujo normal de "ir a mis cursos".
  const noDisponible = course.estado && course.estado !== 'subido' && !yaInscripto;
  const mensajeNoDisponible = course.estado === 'fuera_sistema'
    ? 'Este curso ya no está disponible.'
    : course.estado === 'cancelado'
      ? 'Este curso fue cancelado y ya no admite nuevas inscripciones.'
      : 'Este curso todavía está en revisión — pronto va a estar disponible para la compra.';

  async function comprar(metodoPago) {
    if (!user) return navigate('/ingresar');
    setComprando(true);
    setError('');
    try {
      const resultado = await api.post(`/courses/${id}/enroll`, metodoPago ? { metodo_pago: metodoPago } : {});
      if (resultado.redirect) {
        window.location.href = resultado.redirectUrl;
        return; // se va de la SPA
      }
      setOk(true);
      setComprando(false);
    } catch (err) {
      setError(err.message);
      setComprando(false);
    }
  }

  async function agregarAlCarrito() {
    // A diferencia de "Comprar ahora" (que inscribe al toque y necesita
    // saber a qué cuenta), agregar al carrito no requiere estar logueado:
    // CartContext.agregar ya sabe guardarlo en localStorage cuando no hay
    // sesión (ver comentario de CartContext.jsx) — se fusiona con la
    // cuenta real recién al momento de iniciar sesión.
    setAgregando(true);
    setError('');
    try {
      await agregar(Number(id));
    } catch (err) {
      setError(err.message);
    } finally {
      setAgregando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 720 }}>
        {course.categoria && <span className="badge">{course.categoria}</span>}
        <h1>{course.titulo}</h1>
        {nombreProfesor && <p className="text-muted" style={{ marginTop: -8 }}>Dictado por <strong>{nombreProfesor}</strong></p>}
        <p className="text-muted">{course.descripcion}</p>
        <p style={{ fontSize: '1.4rem', color: colorAcento || 'var(--color-primary)' }}><strong>{formatPrecio(course.precio)}</strong></p>

        {error && <div className="alert alert-error">{error}</div>}
        {ok && <div className="alert alert-success">¡Listo! Ya estás inscripto. Podés entrar al classroom desde "Mis cursos".</div>}

        {ok || yaInscripto ? (
          <Link to="/mis-cursos" className="btn btn-primary">Ir a mis cursos</Link>
        ) : noDisponible ? (
          <p className="text-muted">{mensajeNoDisponible}</p>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {metodos.length > 0 ? (
              <MetodoPagoSelector metodos={metodos} onElegir={comprar} disabled={comprando} />
            ) : (
              <button
                className="btn btn-accent"
                onClick={() => comprar()}
                disabled={comprando}
                style={botonComprar ? { background: botonComprar.color_fondo, color: botonComprar.color_texto } : undefined}
              >
                {comprando ? 'Procesando pago…' : 'Comprar ahora'}
              </button>
            )}
            {enCarrito ? (
              <Link to="/carrito" className="btn btn-outline">Ver carrito</Link>
            ) : (
              <button className="btn btn-outline" onClick={agregarAlCarrito} disabled={agregando}>
                {agregando ? 'Agregando…' : 'Agregar al carrito'}
              </button>
            )}
          </div>
        )}
        {metodos.length === 0 && (
          <p className="text-muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
            * Pago simulado: por ahora no se realiza ningún cobro real.
          </p>
        )}

        {temario.length > 0 && (
          <div style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: '1.2rem' }}>Qué vas a ver en este curso</h2>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginTop: -8 }}>
              {temario.length} {temario.length === 1 ? 'unidad' : 'unidades'} · {cantidadCapitulos} {cantidadCapitulos === 1 ? 'capítulo' : 'capítulos'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
              {temario.map((unidad, i) => (
                <div key={i} style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: '14px 18px' }}>
                  <strong>{unidad.titulo}</strong>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--color-text-muted, #666)' }}>
                    {unidad.capitulos.map((cap, j) => <li key={j} style={{ fontSize: '0.92rem' }}>{cap.titulo}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
