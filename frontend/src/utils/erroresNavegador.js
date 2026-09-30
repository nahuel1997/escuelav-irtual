// Errores de JS de las pantallas → Admin → Errores (origen "navegador").
// Mismo mecanismo que public/js/errores-navegador.js de DBA24: se
// escuchan los errores no atrapados y las promesas rechazadas sin catch, y
// se mandan al backend (solo si hay alguien logueado — la API lo exige).
// Con tope propio para que un error en bucle no mande cientos de pedidos.
import { API_URL } from '../api/client';

const MAX_POR_CARGA = 10;
let enviados = 0;
const vistos = new Set();

function tokenActual() {
  const path = window.location.pathname;
  try {
    if (path.startsWith('/admin-panel')) return localStorage.getItem('admin_token');
    if (path.startsWith('/soporte')) return localStorage.getItem('soporte_token');
    return localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function reportarErrorNavegador({ mensaje, stack, archivo, linea, columna }) {
  try {
    if (!mensaje || enviados >= MAX_POR_CARGA) return;
    const token = tokenActual();
    if (!token) return;
    const clave = `${mensaje}|${archivo}|${linea}`;
    if (vistos.has(clave)) return; // el mismo error una sola vez por carga
    vistos.add(clave);
    enviados += 1;
    fetch(`${API_URL}/app/errores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        mensaje: String(mensaje).slice(0, 2000),
        stack: stack ? String(stack).slice(0, 8000) : undefined,
        pagina: window.location.pathname + window.location.search,
        archivo,
        linea,
        columna,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // nunca romper la página por reportar un error
  }
}

export function instalarCapturaErrores() {
  window.addEventListener('error', (e) => {
    // Errores de carga de recursos (img/script rotos) no traen e.error ni mensaje útil.
    if (!e.message) return;
    reportarErrorNavegador({ mensaje: e.message, stack: e.error && e.error.stack, archivo: e.filename, linea: e.lineno, columna: e.colno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    const mensaje = r instanceof Error ? r.message : String(r);
    // Los errores de la API ya los ve el usuario como mensaje en pantalla
    // (ver api/client.js) y los del servidor quedan del lado del backend.
    if (!mensaje || /^Error \d{3}$/.test(mensaje)) return;
    reportarErrorNavegador({ mensaje: `Promesa rechazada: ${mensaje}`, stack: r && r.stack });
  });
}
