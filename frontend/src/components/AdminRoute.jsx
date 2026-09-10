import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

// Protege /admin-panel/*: exige estar logueado Y tener rol admin. Si no
// cumple, lo manda al login del propio panel de admin (no al login
// general del sitio) para mantener el backoffice como un área aparte.
//
// Usa la sesión propia del admin (useAdminAuth), independiente de la
// sesión pública de alumno/profesor.
export default function AdminRoute() {
  const { user, loading } = useAdminAuth();

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  if (!user || user.rol !== 'admin') {
    return <Navigate to="/admin-panel/ingresar" replace />;
  }

  return <Outlet />;
}
