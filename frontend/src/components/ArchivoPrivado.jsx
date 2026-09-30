import { useEffect, useState } from 'react';
import { api, guardarBlob } from '../api/client';
import Icon from './Icon';

// Muestra un archivo privado (captura de un reporte, adjunto de un ticket):
// las imágenes como miniatura que se abre en grande con un click, el resto
// como botón de descarga. Se baja con el token de la sesión (ver
// api.getBlob) porque esos archivos no son públicos.
export default function ArchivoPrivado({ ruta, nombre, mime }) {
  const esImagen = /^image\//.test(mime || '');
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');
  const [grande, setGrande] = useState(false);

  useEffect(() => {
    if (!esImagen) return undefined;
    let objectUrl = null;
    let vivo = true;
    api.getBlob(ruta)
      .then((blob) => {
        if (!vivo) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e) => vivo && setError(e.message));
    return () => {
      vivo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ruta, esImagen]);

  async function descargar() {
    try {
      guardarBlob(await api.getBlob(ruta), nombre || 'archivo');
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) return <span className="text-muted" style={{ fontSize: '0.8rem' }}>{nombre}: {error}</span>;

  if (!esImagen) {
    return (
      <button type="button" className="btn btn-outline btn-sm" onClick={descargar} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <Icon name="paperclip" size={14} /> {nombre || 'Archivo'}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setGrande(true)}
        title={nombre}
        style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 0, background: '#fff', cursor: 'zoom-in', width: 96, height: 72, overflow: 'hidden' }}
      >
        {url ? <img src={url} alt={nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="text-muted">…</span>}
      </button>
      {grande && url && (
        <div
          role="dialog"
          onClick={() => setGrande(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}
        >
          <img src={url} alt={nombre} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        </div>
      )}
    </>
  );
}
