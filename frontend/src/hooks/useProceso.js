import { useCallback, useEffect, useRef, useState } from 'react';
import { api, guardarBlob } from '../api/client';

// Procesos en segundo plano (P-000123) desde el frontend: inicia el
// proceso, consulta su estado cada 1,5 s hasta que termina y, si generó un
// archivo, lo descarga. Mientras corre, `proceso` tiene número, estado y
// progreso para mostrar la capa gris sobre la sección (ver ProcesoCapa.jsx).
export function useProceso() {
  const [proceso, setProceso] = useState(null);
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const seguir = useCallback((id, { descargar }) => {
    const consultar = async () => {
      try {
        const { proceso: p } = await api.get(`/procesos/${id}`);
        setProceso(p);
        if (p.estado === 'terminado') {
          if (descargar && p.tieneArchivo) guardarBlob(await api.getBlob(`/procesos/${id}/archivo`), p.archivoNombre || `${p.numero}`);
          return;
        }
        if (p.estado === 'error' || p.estado === 'cancelado') {
          setError(p.error || 'El proceso no pudo terminar');
          return;
        }
        timer.current = setTimeout(consultar, 1500);
      } catch (e) {
        setError(e.message);
      }
    };
    consultar();
  }, []);

  const iniciar = useCallback(async (tipo, parametros = {}, { descargar = true } = {}) => {
    setError('');
    try {
      const { proceso: p } = await api.post('/procesos', { tipo, parametros });
      setProceso(p);
      seguir(p.id, { descargar });
      return p;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [seguir]);

  const enCurso = Boolean(proceso && ['pendiente', 'en_curso'].includes(proceso.estado));
  const limpiar = useCallback(() => { setProceso(null); setError(''); }, []);
  return { proceso, enCurso, error, iniciar, limpiar };
}
