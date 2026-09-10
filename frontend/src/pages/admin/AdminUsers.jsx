import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

const ROLES = [
  { value: 'todos', label: 'Todos los roles' },
  { value: 'alumno', label: 'Alumno' },
  { value: 'profesor', label: 'Profesor' },
  { value: 'admin', label: 'Admin' },
];

// Fila con el email y contraseña de un usuario en modo edición — separado
// en su propio componente para que cada fila tenga su propio buffer local
// sin pisarse entre sí.
function FilaEdicion({ user, onGuardar, onCancelar }) {
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function handleGuardar() {
    setGuardando(true);
    setError('');
    try {
      const patch = {};
      if (email.trim() !== user.email) patch.email = email.trim();
      if (password) patch.password = password;
      if (Object.keys(patch).length === 0) {
        onCancelar();
        return;
      }
      await onGuardar(patch);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr>
      <td colSpan={5}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: '8px 0' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Nueva contraseña (opcional, mínimo 6)</label>
            <input
              type="password"
              minLength={6}
              placeholder="Dejar vacío para no cambiarla"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={handleGuardar}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          <button className="btn btn-outline btn-sm" disabled={guardando} onClick={onCancelar}>Cancelar</button>
          {error && <div className="alert alert-error" style={{ margin: 0, flexBasis: '100%' }}>{error}</div>}
        </div>
        {password && (
          <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
            Al resetear la contraseña se cierran todas las sesiones abiertas de este usuario (por las dudas la cuenta esté comprometida).
          </p>
        )}
      </td>
    </tr>
  );
}

// Gestión de cuentas: cambiar el email o resetear la contraseña de
// cualquier usuario (alumno, profesor o admin). No hay autoservicio para
// esto todavía (ver README) — es la única vía si alguien pierde acceso a
// su cuenta o hay que corregir un dato mal cargado. Para dar de alta
// profesores nuevos seguí usando "Profesores"; acá se editan cuentas que
// ya existen.
export default function AdminUsers() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rol, setRol] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [mensaje, setMensaje] = useState('');

  function cargar() {
    setLoading(true);
    return api.get('/admin/users?rol=todos')
      .then((d) => setUsuarios(d.users))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      if (rol !== 'todos' && u.rol !== rol) return false;
      if (!q) return true;
      return `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(q);
    });
  }, [usuarios, rol, busqueda]);

  async function guardarEdicion(userId, patch) {
    const { user: actualizado } = await api.put(`/admin/users/${userId}`, patch);
    setUsuarios((lista) => lista.map((u) => (u.id === userId ? actualizado : u)));
    setEditandoId(null);
    setMensaje(patch.password ? 'Cuenta actualizada — se cerraron sus sesiones abiertas.' : 'Cuenta actualizada.');
    setTimeout(() => setMensaje(''), 4000);
  }

  return (
    <div>
      <h1>Usuarios</h1>
      <p className="text-muted">
        Editá el email o reseteá la contraseña de cualquier cuenta. Para ver o cerrar sus sesiones activas,
        andá a "Sesiones" — el link "Ver sesiones" de cada fila te lleva directo, filtrado a ese usuario.
      </p>

      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 200 }}>
          <label>Rol</label>
          <select value={rol} onChange={(e) => setRol(e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0, minWidth: 240, flex: 1 }}>
          <label>Buscar</label>
          <input placeholder="Nombre, apellido o email" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
      </div>

      {mensaje && <div className="alert alert-success" style={{ marginTop: 16 }}>{mensaje}</div>}
      {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}

      <div className="card" style={{ overflowX: 'auto', marginTop: 16 }}>
        {loading ? (
          <p className="text-muted">Cargando…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Cuenta validada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => (
                editandoId === u.id ? (
                  <FilaEdicion
                    key={u.id}
                    user={u}
                    onGuardar={(patch) => guardarEdicion(u.id, patch)}
                    onCancelar={() => setEditandoId(null)}
                  />
                ) : (
                  <tr key={u.id}>
                    <td>{u.nombre} {u.apellido}</td>
                    <td>{u.email}</td>
                    <td><span className="badge">{u.rol}</span></td>
                    <td>{u.email_verificado ? '✓' : '—'}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditandoId(u.id)}>Editar</button>
                      <Link className="btn btn-outline btn-sm" to={`/admin-panel/logins?userId=${u.id}`}>Ver sesiones</Link>
                    </td>
                  </tr>
                )
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={5} className="text-muted">No hay usuarios que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
