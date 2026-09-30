// Registro de páginas vistas para Admin → Tráfico. Se manda una vez por
// cambio de pantalla, con un id anónimo del navegador (sin datos
// personales) para contar personas distintas; si hay sesión, el backend
// además sabe el rol. El backoffice no cuenta.
import { API_URL } from '../api/client';

const CLAVE = 'visitante_id';

function visitanteId() {
  try {
    let id = localStorage.getItem(CLAVE);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).slice(0, 64);
      localStorage.setItem(CLAVE, id);
    }
    return id;
  } catch {
    return null;
  }
}

let ultima = null;

export function registrarVista(pathname) {
  if (!pathname || pathname === ultima) return;
  if (pathname.startsWith('/admin-panel') || pathname.startsWith('/soporte')) return;
  ultima = pathname;
  let token = null;
  try { token = localStorage.getItem('token'); } catch { token = null; }
  fetch(`${API_URL}/app/vista`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ pagina: pathname, visitante: visitanteId(), referencia: document.referrer || undefined }),
    keepalive: true,
  }).catch(() => {});
}
