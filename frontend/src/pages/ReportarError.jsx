import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatFecha } from '../utils/fecha';
import ArchivoPrivado from '../components/ArchivoPrivado';

const ESTADOS = {
  nuevo: { label: 'Recibido', clase: 'badge-warning' },
  en_revision: { label: 'En revisión', clase: 'badge-warning' },
  resuelto: { label: 'Resuelto', clase: 'badge-success' },
  descartado: { label: 'Cerrado', clase: '' },
};

function DetalleReporte({ id }) {
  const [reporte, setReporte] = useState(null);
  useEffect(() => { api.get(`/app/reportes-error/${id}`).then((d) => setReporte(d.reporte)); }, [id]);
  if (!reporte) return <p className="text-muted">Cargando…</p>;
  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 8px' }}>{reporte.descripcion}</p>
      {reporte.adjuntos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {reporte.adjuntos.map((a) => (
            <ArchivoPrivado key={a.id} ruta={`/app/reportes-error/adjuntos/${a.id}`} nombre={a.nombre_original} mime={a.mime} />
          ))}
        </div>
      )}
    </div>
  );
}

// "Reportar error" (alumno/profesor): cuenta qué pasó, con hasta 5
// capturas, y sigue el estado de sus reportes. Lo atiende el admin en
// Errores → "Errores alertados".
export default function ReportarError() {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [capturas, setCapturas] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [reportes, setReportes] = useState([]);
  const [abierto, setAbierto] = useState(null);

  const cargar = () => api.get('/app/reportes-error').then((d) => setReportes(d.reportes)).catch(() => {});
  useEffect(() => { cargar(); }, []);

  function elegirCapturas(e) {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length > 5) {
      setError('Podés adjuntar hasta 5 capturas');
      e.target.value = '';
      return;
    }
    setError('');
    setCapturas(archivos);
  }

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      const form = new FormData();
      form.append('titulo', titulo.trim());
      form.append('descripcion', descripcion.trim());
      // De qué pantalla venía (si llegó desde un link con ?desde=...).
      const desde = new URLSearchParams(window.location.search).get('desde');
      if (desde) form.append('pagina', desde);
      capturas.forEach((c) => form.append('capturas', c));
      const { id } = await api.postForm('/app/reportes-error', form);
      setTitulo('');
      setDescripcion('');
      setCapturas([]);
      e.target.reset();
      setOk(`¡Gracias! Recibimos tu reporte #${id}. Te avisamos acá cuando lo revisemos.`);
      setTimeout(() => setOk(''), 6000);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <h1>Reportar un error</h1>
        <p className="text-muted">¿Algo no funciona como debería? Contanos qué pasó y, si podés, sumá capturas de pantalla.</p>

        {ok && <div className="alert alert-success">{ok}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form className="card" onSubmit={enviar}>
          <div className="field">
            <label>Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={200} placeholder="Ej: el video del capítulo 3 no carga" required />
          </div>
          <div className="field">
            <label>¿Qué pasó?</label>
            <textarea rows={5} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={5000} placeholder="Qué estabas haciendo, qué esperabas que pase y qué pasó." required />
          </div>
          <div className="field">
            <label>Capturas (opcional, hasta 5 imágenes de 5 MB)</label>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={elegirCapturas} />
          </div>
          <button className="btn btn-primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar reporte'}</button>
        </form>

        <h2 style={{ marginTop: 32 }}>Mis reportes</h2>
        {reportes.length === 0 ? (
          <p className="text-muted">Todavía no mandaste ningún reporte.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reportes.map((r) => {
              const est = ESTADOS[r.estado] || { label: r.estado, clase: '' };
              return (
                <div key={r.id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div>
                      <strong>#{r.id} · {r.titulo}</strong>
                      <div className="text-muted" style={{ fontSize: '0.85rem' }}>{formatFecha(r.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${est.clase}`}>{est.label}</span>
                      <button className="btn btn-outline btn-sm" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>{abierto === r.id ? 'Ocultar' : 'Ver'}</button>
                    </div>
                  </div>
                  {r.respuesta && (
                    <div className="alert alert-success" style={{ margin: '10px 0 0' }}><strong>Respuesta:</strong> {r.respuesta}</div>
                  )}
                  {abierto === r.id && <DetalleReporte id={r.id} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
