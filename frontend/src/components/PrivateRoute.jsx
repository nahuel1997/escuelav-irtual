import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Protege rutas que requieren estar logueado. Si además se pasa `roles`,
// exige que el usuario tenga uno de esos roles (ej: solo "profesor").
export default function PrivateRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  if (!user) {
    return <Navigate to="/ingresar" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.rol)) {
    return <Navigate to="/panel" replace />;
  }

  return <Outlet />;
}
