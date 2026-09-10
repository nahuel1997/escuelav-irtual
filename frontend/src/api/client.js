// Cliente HTTP mínimo para hablar con la API. Centraliza:
// - la URL base (VITE_API_URL)
// - el agregado automático del header Authorization con el token guardado
// - el manejo uniforme de errores (la API siempre responde { error: "..." })
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
// Exportado para poder armar, en el panel de admin, la URL exacta que un
// sistema externo tiene que usar para pegarle a la API de datos
// (ver AdminApis.jsx, pestaña "Detalle y uso") — no alcanza con
// API_ORIGIN porque esa URL sí necesita el prefijo /api.
export { API_URL };
// Origen del backend sin el sufijo /api, para armar links directos a
// archivos servidos como estáticos (ej: /uploads/tareas/...) y para la
// conexión de sockets del chat de soporte (que no cuelga de /api, ver
// hooks/useChatSocket.js).
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

// El panel de admin (/admin-panel/*), el de soporte (/soporte/*) y el
// sitio público tienen sesiones independientes, cada una en su propia
// clave de localStorage (ver AdminAuthContext.jsx / SupportAuthContext.jsx).
// Cuando no se pasa tokenKey explícito, lo elegimos según la ruta actual
// del navegador: así cada pantalla habla con la API usando la sesión que
// le corresponde, sin que una pise a la otra.
function getToken(tokenKey) {
  if (tokenKey) return localStorage.getItem(tokenKey);
  const path = window.location.pathname;
  if (path.startsWith('/admin-panel')) return localStorage.getItem('admin_token');
  if (path.startsWith('/soporte')) return localStorage.getItem('soporte_token');
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, isFormData = false, auth = true, tokenKey } = {}) {
  const headers = {};
  if (!isFormData) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken(tokenKey);
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const message = (data && data.error) || `Error ${res.status}`;
    throw new Error(message);
  }
  return data;
}

// Descarga un archivo (blob) en vez de parsear JSON — lo usa el creador de CV.
async function requestBlob(path, { method = 'POST', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.blob();
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  postForm: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData, isFormData: true }),
  blob: requestBlob,
};
