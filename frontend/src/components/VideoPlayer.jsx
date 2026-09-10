import { useEffect, useId, useRef, useState } from 'react';

// Reproductor embebido de YouTube/Vimeo con tracking de progreso. No hay
// video propio en esta app (se sube el link, no el archivo — ver
// AdminCourses/Classroom), así que acá se detecta el proveedor por el
// formato de la URL y se usa la API oficial de cada uno (IFrame API de
// YouTube, Player.js de Vimeo) para saber cuánto se vio de verdad, no solo
// "se abrió la página". `onProgress(segundosActuales, duracionSegundos)`
// se llama cada REPORTE_INTERVALO_MS mientras se reproduce — el padre
// (CourseChapter.jsx) es quien manda eso al backend y confía en la
// respuesta del servidor para el % mostrado (el cálculo real vive en
// curriculum.service.js, no acá, para no poder "inflar" el progreso
// manipulando el cliente).
const REPORTE_INTERVALO_MS = 5000;

// Vimeo privado ("solo se puede ver por acá"): en vez de link público
// (vimeo.com/123456789), Vimeo da un link con un hash extra
// (vimeo.com/123456789/abcd1234ef, o ya en formato embed
// player.vimeo.com/video/123456789?h=abcd1234ef) — sin ese hash el video
// no reproduce aunque el id sea correcto. Se detectan los dos formatos y
// se arma la URL del embed con el hash si vino.
export function parseVideoUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/);
  if (yt) return { proveedor: 'youtube', id: yt[1] };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:[/?](?:h=)?([a-zA-Z0-9]+))?/);
  if (vimeo) return { proveedor: 'vimeo', id: vimeo[1], hash: vimeo[2] || null };
  return null;
}

let youtubeApiPromise = null;
function loadYoutubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (anterior) anterior();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

let vimeoApiPromise = null;
function loadVimeoApi() {
  if (window.Vimeo && window.Vimeo.Player) return Promise.resolve(window.Vimeo);
  if (vimeoApiPromise) return vimeoApiPromise;
  vimeoApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://player.vimeo.com/api/player.js';
    script.onload = () => resolve(window.Vimeo);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return vimeoApiPromise;
}

export default function VideoPlayer({ videoUrl, onProgress }) {
  const containerId = `video-player-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const [error, setError] = useState('');
  const info = parseVideoUrl(videoUrl);

  useEffect(() => {
    let cancelado = false;
    setError('');
    if (!info) {
      setError('No se reconoce este link de video (tiene que ser un link de YouTube o Vimeo).');
      return undefined;
    }

    function reportarYoutube() {
      const p = playerRef.current;
      if (!p || typeof p.getCurrentTime !== 'function') return;
      onProgress?.(p.getCurrentTime(), p.getDuration());
    }

    async function iniciar() {
      if (info.proveedor === 'youtube') {
        const YT = await loadYoutubeApi();
        if (cancelado) return;
        playerRef.current = new YT.Player(containerId, {
          videoId: info.id,
          playerVars: { rel: 0 },
          events: {
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                intervalRef.current = setInterval(reportarYoutube, REPORTE_INTERVALO_MS);
              } else if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              if (e.data === YT.PlayerState.ENDED) reportarYoutube();
            },
          },
        });
      } else if (info.proveedor === 'vimeo') {
        const Vimeo = await loadVimeoApi();
        if (cancelado) return;
        const iframe = document.getElementById(containerId);
        if (!iframe) return;
        const player = new Vimeo.Player(iframe);
        playerRef.current = player;
        let ultimoReporte = 0;
        player.on('timeupdate', (data) => {
          const ahora = Date.now();
          if (ahora - ultimoReporte < REPORTE_INTERVALO_MS) return;
          ultimoReporte = ahora;
          onProgress?.(data.seconds, data.duration);
        });
        player.on('ended', async () => {
          const duracion = await player.getDuration();
          onProgress?.(duracion, duracion);
        });
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy(); } catch (_e) { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoUrl]);

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
      {info?.proveedor === 'vimeo' ? (
        <iframe
          id={containerId}
          src={`https://player.vimeo.com/video/${info.id}${info.hash ? `?h=${info.hash}` : ''}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Video del capítulo"
        />
      ) : (
        <div id={containerId} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      )}
    </div>
  );
}
