import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useProceso } from '../hooks/useProceso';
import ProcesoCapa from '../components/ProcesoCapa';

// "Novedades": el registro de versiones de la plataforma (lo carga el admin
// en Versiones). El PDF se arma en segundo plano, con número de
// seguimiento, como todos los procesos largos.
export default function Novedades() {
  const [versiones, setVersiones] = useState(null);
  const { proceso, enCurso, error, iniciar } = useProceso();
  useEffect(() => { api.get('/app/novedades').then((d) => setVersiones(d.versiones)).catch(() => setVersiones([])); }, []);

  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 860, position: 'relative' }}>
        <ProcesoCapa proceso={proceso} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ margin: 0 }}>Novedades</h1>
          <button className="btn btn-outline btn-sm" disabled={enCurso} onClick={() => iniciar('pdf_versiones')}>Descargar en PDF</button>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
        {!versiones ? <p className="text-muted">Cargando…</p> : versiones.length === 0 ? <p className="text-muted">Todavía no hay novedades.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {versiones.map((v) => (
              <div key={v.version} className="card" style={{ margin: 0 }}>
                <strong>{v.titulo}</strong> <span className="text-muted">· versión {v.version} · {new Date(`${String(v.fecha).slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR')}</span>
                <ul style={{ margin: '8px 0 0' }}>{String(v.cambios).split('\n').map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
