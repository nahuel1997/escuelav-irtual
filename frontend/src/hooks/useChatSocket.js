import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_ORIGIN } from '../api/client';

// Conexión de WebSocket para el chat de soporte (mensajes en vivo — el
// historial se carga por REST normal, ver chat.controller.js/
// support.controller.js). Se abre una sola vez por token y se cierra
// sola al desmontar el componente que la usa o si el token cambia
// (logout, por ejemplo). No cuelga de VITE_API_URL (que tiene el sufijo
// /api) sino de API_ORIGIN — Socket.io tiene su propio protocolo, no es
// una ruta REST más.
export function useChatSocket(token) {
  const [socket, setSocket] = useState(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConectado(false);
      return undefined;
    }

    const s = io(API_ORIGIN, { auth: { token }, reconnectionAttempts: 10 });
    s.on('connect', () => setConectado(true));
    s.on('disconnect', () => setConectado(false));
    setSocket(s);

    return () => {
      s.close();
      setSocket(null);
      setConectado(false);
    };
  }, [token]);

  return { socket, conectado };
}
