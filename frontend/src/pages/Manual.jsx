import { useEffect, useState } from 'react';
import { api } from '../api/client';
import TextoManual from '../components/TextoManual';

// Manual de uso del rol del usuario (lo edita el admin en Manual).
export default function Manual() {
  const [secciones, setSecciones] = useState(null);
  useEffect(() => { api.get('/app/manual').then((d) => setSecciones(d.secciones)).catch(() => setSecciones([])); }, []);
  return (
    <section className="section">
      <div className="container" style={{ maxWidth: 860 }}>
        <h1>Manual de uso</h1>
        {!secciones ? <p className="text-muted">Cargando…</p> : secciones.length === 0 ? <p className="text-muted">Todavía no hay contenido.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {secciones.map((s) => (
              <div key={s.id} className="card" style={{ margin: 0 }}>
                <h3 style={{ marginTop: 0 }}>{s.titulo}</h3>
                <TextoManual texto={s.contenido} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
