import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatFecha } from '../../utils/fecha';
import { refrescarEstadoPublico } from '../../hooks/useEstadoPublico';

const ESTADOS = { activa: 'Activa', reparacion: 'En reparación', oculta: 'Oculta' };

// Admin → Pantallas (Habilitación de DBA24): poner una sección de
// alumnos/profesores en reparación u ocultarla, y bloquear una sección a un
// usuario puntual. "Reportar error" y "Mis consultas" nunca se apagan.
export default function AdminPantallas() {
  const [pantallas, setPantallas] = useState(null);
  const [bloqueos, setBloqueos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({ userId: '', pantalla: '', motivo: '' });
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    api.get('/admin/pantallas').then((d) => { setPantallas(d.pantallas); setBloqueos(d.bloqueos); });
    api.get('/admin/users?rol=todos').then((d) => setUsuarios(d.users.filter((u) => ['alumno', 'profesor'].includes(u.rol))));
  }, []);

  async function guardar() {
    try {
      const body = Object.fromEntries(Object.entries(pantallas).map(([k, p]) => [k, { estado: p.estado, mensaje: p.mensaje }]));
      const r = await api.put('/admin/pantallas', body);
      setPantallas(r.pantallas);
      refrescarEstadoPublico();
      setAviso('Guardado.');
      setTimeout(() => setAviso(''), 2500);
    } catch (e) {
      setAviso(e.message);
    }
  }

  async function bloquear(e) {
    e.preventDefault();
    try {
      const r = await api.post('/admin/pantallas/bloqueos', { ...form, userId: Number(form.userId) });
      setBloqueos(r.bloqueos);
      setForm({ userId: '', pantalla: '', motivo: '' });
    } catch (err) {
      setAviso(err.message);
    }
  }

  async function desbloquear(id) {
    const r = await api.delete(`/admin/pantallas/bloqueos/${id}`);
    setBloqueos(r.bloqueos);
  }

  if (!pantallas) return <p className="text-muted">Cargando…</p>;
  return (
    <div>
      <h1 style={{ margin: 0 }}>Pantallas</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>Apagá una sección mientras la arreglás, o bloqueásela a alguien puntual. El admin y soporte nunca quedan afuera.</p>
      {aviso && <div className={`alert ${aviso === 'Guardado.' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>{aviso}</div>}

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        <table>
          <thead><tr><th>Sección</th><th>Estado</th><th>Mensaje para el usuario</th></tr></thead>
          <tbody>
            {Object.entries(pantallas).map(([k, p]) => (
              <tr key={k}>
                <td><strong>{p.nombre}</strong><div className="text-muted" style={{ fontSize: '0.78rem' }}>{p.rutas.join(', ')}</div></td>
                <td>
                  <select value={p.estado} onChange={(e) => setPantallas({ ...pantallas, [k]: { ...p, estado: e.target.value } })}>
                    {Object.entries(ESTADOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </td>
                <td><input value={p.mensaje} onChange={(e) => setPantallas({ ...pantallas, [k]: { ...p, mensaje: e.target.value } })} placeholder="(mensaje por defecto)" maxLength={300} style={{ width: '100%', minWidth: 220 }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={guardar}>Guardar</button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Bloquear una sección a un usuario</h3>
        <form onSubmit={bloquear} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Usuario</label>
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
              <option value="">Elegí…</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} {u.apellido} ({u.rol})</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Sección</label>
            <select value={form.pantalla} onChange={(e) => setForm({ ...form, pantalla: e.target.value })} required>
              <option value="">Elegí…</option>
              {Object.entries(pantallas).map(([k, p]) => <option key={k} value={k}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
            <label>Motivo (lo ve el usuario)</label>
            <input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} maxLength={300} />
          </div>
          <button className="btn btn-danger btn-sm">Bloquear</button>
        </form>
        <table style={{ marginTop: 12 }}>
          <tbody>
            {bloqueos.map((b) => (
              <tr key={b.id}>
                <td>{b.nombre} {b.apellido} <span className="text-muted">({b.email})</span></td>
                <td>{pantallas[b.pantalla]?.nombre || b.pantalla}</td>
                <td className="text-muted">{b.motivo || '—'}</td>
                <td className="text-muted">{formatFecha(b.created_at)}</td>
                <td><button className="btn btn-outline btn-sm" onClick={() => desbloquear(b.id)}>Desbloquear</button></td>
              </tr>
            ))}
            {bloqueos.length === 0 && <tr><td className="text-muted">No hay bloqueos puntuales.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
