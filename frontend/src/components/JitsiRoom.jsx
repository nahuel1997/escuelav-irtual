import { useEffect, useRef } from 'react';

// Carga el script de la External API de Jitsi Meet una sola vez por
// dominio (aunque se monten varias salas durante la sesión) y avisa
// cuando ya está listo, para no pisar una carga en curso.
const scriptPromises = {};
function cargarExternalApi(dominio) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  if (scriptPromises[dominio]) return scriptPromises[dominio];
  scriptPromises[dominio] = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://${dominio}/external_api.js`;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se pudo cargar Jitsi Meet'));
    document.body.appendChild(script);
  });
  return scriptPromises[dominio];
}

// Embebe la videollamada vía la External API oficial de Jitsi
// (https://<dominio>/external_api.js), NO un <iframe> a mano: meet.jit.si
// bloquea el embedding directo por iframe en varios casos (X-Frame-Options),
// y la External API además nos da un objeto para controlar/cerrar la
// llamada prolijamente al salir de la sala.
export default function JitsiRoom({ dominio, roomId, displayName }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let cancelado = false;

    cargarExternalApi(dominio)
      .then(() => {
        if (cancelado || !containerRef.current) return;
        apiRef.current = new window.JitsiMeetExternalAPI(dominio, {
          roomName: roomId,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'desktop', 'fullscreen', 'hangup',
              'chat', 'settings', 'raisehand', 'tileview',
            ],
          },
        });
      })
      .catch(() => {
        // Si falla la carga del script (sin internet hacia meet.jit.si,
        // por ejemplo), no rompemos el resto de la sala — el chat sigue
        // funcionando igual, solo no hay video. El contenedor queda vacío
        // en vez de tirar una excepción no atrapada.
      });

    return () => {
      cancelado = true;
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [dominio, roomId, displayName]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 420, background: '#111', borderRadius: 12, overflow: 'hidden' }} />;
}
