import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Estado público de la app (modo mantenimiento, textos de páginas de
// error, modo oscuro, feriados) — GET /api/estado-publico. Una sola
// consulta compartida por todos los componentes que lo usan, refrescada
// cada minuto (así un mantenimiento que el admin prende o apaga se nota
// sin recargar).
const REFRESCO_MS = 60 * 1000;
let cache = null;
let promesa = null;
let pedidoEn = 0;
const oyentes = new Set();

function pedir(forzar = false) {
  if (!forzar && promesa && Date.now() - pedidoEn < REFRESCO_MS) return promesa;
  pedidoEn = Date.now();
  promesa = api.get('/estado-publico', { auth: false })
    .then((d) => {
      cache = d;
      // Copia para el ErrorBoundary, que no puede usar hooks.
      try { localStorage.setItem('paginas_error', JSON.stringify(d.paginas_error || {})); } catch { /* sin storage */ }
      oyentes.forEach((fn) => fn(d));
      return d;
    })
    .catch(() => cache);
  return promesa;
}

export function refrescarEstadoPublico() {
  return pedir(true);
}

export function useEstadoPublico() {
  const [estado, setEstado] = useState(cache);
  useEffect(() => {
    oyentes.add(setEstado);
    pedir();
    const t = setInterval(() => pedir(), REFRESCO_MS);
    return () => {
      oyentes.delete(setEstado);
      clearInterval(t);
    };
  }, []);
  return estado;
}
