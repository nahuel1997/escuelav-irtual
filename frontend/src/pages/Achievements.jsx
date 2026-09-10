import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Achievements() {
  const [todos, setTodos] = useState([]);
  const [mios, setMios] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/achievements', { auth: false }), api.get('/achievements/mine')])
      .then(([a, b]) => {
        setTodos(a.achievements);
        setMios(b.achievements);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner-msg">Cargando…</div>;

  const idsObtenidos = new Set(mios.map((m) => m.id));

  return (
    <section className="section">
      <div className="container">
        <h1>Mis logros</h1>
        <p className="text-muted">{mios.length} de {todos.length} logros obtenidos.</p>

        <div className="grid grid-3" style={{ marginTop: 24 }}>
          {todos.map((a) => {
            const obtenido = idsObtenidos.has(a.id);
            return (
              <div key={a.id} className="card" style={{ opacity: obtenido ? 1 : 0.45, textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem' }}>{a.icono}</div>
                <h3>{a.titulo}</h3>
                <p className="text-muted">{a.descripcion}</p>
                <span className={`badge ${obtenido ? 'badge-success' : ''}`}>{obtenido ? 'Obtenido' : 'Pendiente'}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
