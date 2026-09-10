import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// "Intro" / home del usuario logueado: bienvenida + accesos rápidos.
// Las tarjetas cambian según el rol — alumno y profesor tienen funciones
// distintas en la plataforma, no tiene sentido ofrecerles los mismos
// atajos (ver Navbar.jsx, misma lógica de separación).
export default function UserHome() {
  const { user } = useAuth();

  // Banner de "validá tu cuenta": no bloquea nada (el login ya funciona
  // sin validar, ver auth.controller.js), solo invita a hacerlo. Se
  // esconde solo una vez que email_verificado pasa a true.
  const bannerVerificacion = !user.email_verificado && (
    <div className="alert" style={{ background: '#fff4e0', color: '#8a5a00', border: '1px solid #f0d59a', marginBottom: 24 }}>
      Todavía no validaste tu cuenta. Te mandamos un código de 6 dígitos por mail.{' '}
      <Link to="/verificar-email" style={{ fontWeight: 600 }}>Validar ahora</Link>
    </div>
  );

  if (user.rol === 'profesor') {
    return (
      <section className="section">
        <div className="container">
          <h1>Hola, {user.nombre}</h1>
          <p className="text-muted">Desde acá gestionás tus cursos y las entregas de tus alumnos.</p>
          {bannerVerificacion}

          <div className="grid grid-3" style={{ marginTop: 32 }}>
            <Link to="/mis-cursos" className="card">
              <h3>Mis cursos</h3>
              <p className="text-muted">Cursos que dictás — accedé al classroom de cada uno</p>
            </Link>
            <Link to="/calendario" className="card">
              <h3>Calendario</h3>
              <p className="text-muted">Aceptá o rechazá los turnos que te piden tus alumnos</p>
            </Link>
            <Link to="/perfil" className="card">
              <h3>Mi perfil</h3>
              <p className="text-muted">Editá tus datos personales</p>
            </Link>
            <Link to="/terminos" className="card">
              <h3>Términos y condiciones</h3>
              <p className="text-muted">Revisá las condiciones de uso</p>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  // alumno
  return (
    <section className="section">
      <div className="container">
        <h1>Hola, {user.nombre}</h1>
        <p className="text-muted">Este es tu panel: seguí tus cursos, entregá tareas y armá tu CV.</p>
        {bannerVerificacion}

        <div className="grid grid-3" style={{ marginTop: 32 }}>
          <Link to="/mis-cursos" className="card">
            <h3>Mis cursos</h3>
            <p className="text-muted">Cursos en los que estás inscripto</p>
          </Link>
          <Link to="/logros" className="card">
            <h3>Mis logros</h3>
            <p className="text-muted">Revisá los hitos que ya alcanzaste</p>
          </Link>
          <Link to="/calendario" className="card">
            <h3>Calendario</h3>
            <p className="text-muted">Pedí un turno con tu profesor</p>
          </Link>
          <Link to="/cv" className="card">
            <h3>Creador de CV</h3>
            <p className="text-muted">Generá tu currículum en PDF</p>
          </Link>
          <Link to="/perfil" className="card">
            <h3>Mi perfil</h3>
            <p className="text-muted">Editá tus datos personales</p>
          </Link>
          <Link to="/tienda" className="card">
            <h3>Tienda de cursos</h3>
            <p className="text-muted">Sumate a un nuevo curso</p>
          </Link>
          <Link to="/terminos" className="card">
            <h3>Términos y condiciones</h3>
            <p className="text-muted">Revisá las condiciones de uso</p>
          </Link>
        </div>
      </div>
    </section>
  );
}
