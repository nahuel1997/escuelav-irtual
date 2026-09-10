// Contexto de autenticación PROPIO del panel de administración.
//
// Antes, el panel de admin usaba el mismo AuthContext y la misma clave de
// localStorage ('token') que el sitio público. Eso significaba que loguearse
// como admin pisaba la sesión de alumno/profesor (y viceversa): no se podían
// tener las dos sesiones activas al mismo tiempo en el mismo navegador.
//
// La solución es duplicar el mismo patrón de AuthContext pero con su propia
// clave de localStorage ('admin_token'). Los dos contextos se montan juntos
// en main.jsx y viven en paralelo durante toda la vida de la app, así que
// cada uno mantiene su propia sesión sin que una pise a la otra. El cliente
// HTTP (api/client.js) decide con cuál token pegarle a la API mirando si la
// ruta actual empieza con /admin-panel.
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me', { tokenKey: 'admin_token' })
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem('admin_token'))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.post('/auth/login', { email, password }, { auth: false });
    localStorage.setItem('admin_token', token);
    setUser(user);
    return user;
  }

  function logout() {
    // Best-effort, igual que en el AuthContext público: si falla no bloquea
    // el logout local.
    api.post('/auth/logout', {}, { tokenKey: 'admin_token' }).catch(() => {});
    localStorage.removeItem('admin_token');
    setUser(null);
  }

  return (
    <AdminAuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth debe usarse dentro de un <AdminAuthProvider>');
  return ctx;
}
