import { Navigate, Outlet } from 'react-router-dom';
import { useSupportAuth } from '../context/SupportAuthContext';

// Protege /soporte/*: exige estar logueado Y tener rol soporte. Si no
// cumple, lo manda al login propio del panel de soporte (no al login
// general del sitio ni al de admin) — mismo criterio que AdminRoute.
export default function SupportRoute() {
  const { user, loading } = useSupportAuth();

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  if (!user || user.rol !== 'soporte') {
    return <Navigate to="/soporte/ingresar" replace />;
  }

  return <Outlet />;
}
