import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useEstadoPublico } from './useEstadoPublico';

// Habilitación de pantallas (Admin → Pantallas): qué secciones están en
// reparación u ocultas, y cuáles tiene bloqueadas este usuario. El backend
// igual lo hace cumplir en la API; esto es para el menú y el cartel.
export function pantallaDeRuta(pathname, pantallas) {
  if (!pantallas) return null;
  for (const [clave, p] of Object.entries(pantallas)) {
    if ((p.rutas || []).some((r) => pathname === r || pathname.startsWith(`${r}/`))) return clave;
  }
  return null;
}

export function usePantallas(user) {
  const estado = useEstadoPublico();
  const [bloqueos, setBloqueos] = useState([]);
  const userId = user && user.id;
  const rol = user && user.rol;

  useEffect(() => {
    if (!userId || !['alumno', 'profesor'].includes(rol)) return undefined;
    let vivo = true;
    api.get('/app/mis-bloqueos', { tokenKey: 'token' }).then((d) => vivo && setBloqueos(d.bloqueos)).catch(() => {});
    return () => { vivo = false; };
  }, [userId, rol]);

  const pantallas = estado && estado.pantallas;
  const exento = !user || ['admin', 'soporte'].includes(user.rol);

  // null = se puede usar; si no, { titulo, mensaje } para el cartel.
  function restriccion(pathname) {
    if (exento) return null;
    const clave = pantallaDeRuta(pathname, pantallas);
    if (!clave) return null;
    const p = pantallas[clave];
    if (p.estado !== 'activa') return { titulo: `${p.nombre}: en reparación`, mensaje: p.mensaje || 'Estamos arreglando esta sección. Volvé en un rato.' };
    const b = bloqueos.find((x) => x.pantalla === clave);
    if (b) return { titulo: `No tenés acceso a ${p.nombre}`, mensaje: b.motivo || 'Si creés que es un error, abrí una consulta.' };
    return null;
  }

  // Para el menú: ocultar lo que está oculto o bloqueado para este usuario.
  function visibleEnMenu(ruta) {
    if (exento) return true;
    const clave = pantallaDeRuta(ruta, pantallas);
    if (!clave) return true;
    return pantallas[clave].estado !== 'oculta' && !bloqueos.some((x) => x.pantalla === clave);
  }

  return { restriccion, visibleEnMenu };
}
