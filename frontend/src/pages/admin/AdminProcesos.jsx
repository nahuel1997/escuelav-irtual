import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

const ESTADOS = {
  pendiente: { label: 'En cola', clase: 'badge-warning' },
  en_curso: { label: 'En curso', clase: 'badge-warning' },
  terminado: { label: 'Terminado', clase: 'badge-success' },
  error: { label: 'Error', clase: 'badge-danger' },
  cancelado: { label: 'Cancelado', clase: '' },
};

// Admin → Procesos: todos los procesos en segundo plano de la app (PDFs,
// envíos, campañas), con su número de seguimiento, estado y error.
export default function AdminProcesos() {
  const [data, setData] = useState({ procesos: [], tipos: [] });
  const [filtro, setFiltro] = useState({ estado: '', tipo: '' });
  const [error, setError] = useState('');

  const cargar = (f = filtro) => api.get(`/admin/procesos?estado=${f.estado}&tipo=${f.tipo}`).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
    const t = setInterval(() => cargar(), 5000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function reintentar(id) {
    try {
      await api.post(`/admin/procesos/${id}/reintentar`, {});
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const cambiar = (patch) => { const f = { ...filtro, ...patch }; setFiltro(f); cargar(f); };

  return (
    <div>
      <h1 style={{ margin: 0 }}>Procesos en segundo plano</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>Todo lo largo (PDFs, envíos por mail, campañas) corre acá con su número de seguimiento. Se actualiza cada 5 segundos.</p>
      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Estado</label>
          <select value={filtro.estado} onChange={(e) => cambiar({ estado: e.target.value })}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Tipo</label>
          <select value={filtro.tipo} onChange={(e) => cambiar({ tipo: e.target.value })}>
            <option value="">Todos</option>
            {data.tipos.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead><tr><th>Número</th><th>Proceso</th><th>Usuario</th><th>Estado</th><th>Creado</th><th>Terminado</th><th></th></tr></thead>
          <tbody>
            {data.procesos.map((p) => (
              <tr key={p.id}>
                <td><strong>{p.numero}</strong></td>
                <td>{p.titulo}<div className="text-muted" style={{ fontSize: '0.78rem' }}>{p.tipo}</div>{p.error && <div style={{ color: 'var(--color-danger)', fontSize: '0.82rem' }}>{p.error}</div>}</td>
                <td>{p.usuario || '—'}</td>
                <td><span className={`badge ${ESTADOS[p.estado]?.clase || ''}`}>{ESTADOS[p.estado]?.label || p.estado}</span>{p.estado === 'en_curso' && ` ${p.progreso}%`}</td>
                <td className="text-muted">{formatFecha(p.creado)}</td>
                <td className="text-muted">{p.terminado ? formatFecha(p.terminado) : '—'}</td>
                <td>{['error', 'cancelado'].includes(p.estado) && <button className="btn btn-outline btn-sm" onClick={() => reintentar(p.id)}>Reintentar</button>}</td>
              </tr>
            ))}
            {data.procesos.length === 0 && <tr><td colSpan={7} className="text-muted">No hay procesos.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
