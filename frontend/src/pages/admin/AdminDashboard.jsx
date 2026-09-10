import { useEffect, useState } from 'react';
import { api } from '../../api/client';

function StatCard({ label, value }) {
  return (
    <div className="card">
      <p className="text-muted" style={{ margin: 0 }}>{label}</p>
      <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/dashboard').then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="grid grid-3" style={{ marginTop: 16, marginBottom: 32 }}>
        <StatCard label="Cursos vendidos" value={data.cursosVendidos} />
        <StatCard label="Alumnos" value={data.alumnos} />
        <StatCard label="Cursos completados" value={data.cursosCompletados} />
        <StatCard label="Tareas revisadas" value={data.tareasRevisadasTotal} />
      </div>

      <h3>Profesores</h3>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Cursos que dicta</th>
              <th>Tareas revisadas</th>
              <th>Tareas pendientes</th>
            </tr>
          </thead>
          <tbody>
            {data.profesores.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre} {p.apellido}</td>
                <td>{p.email}</td>
                <td>{p.cursos}</td>
                <td>{p.tareas_revisadas}</td>
                <td>{p.tareas_pendientes}</td>
              </tr>
            ))}
            {data.profesores.length === 0 && (
              <tr><td colSpan={5} className="text-muted">Todavía no hay profesores cargados.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
