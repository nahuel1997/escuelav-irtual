import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAdminAuth } from '../../context/AdminAuthContext';

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

// Fila con el motivo del bloqueo en modo edición — mismo espíritu que
// FilaEdicion: buffer local propio para no pisarse entre filas.
function FilaBloqueo({ user, onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirmar() {
    setGuardando(true);
    setError('');
    try {
      await onConfirmar(motivo.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr>
      <td colSpan={6}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', padding: '8px 0' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 280, flex: 1 }}>
            <label>Motivo del bloqueo de {user.nombre} {user.apellido}</label>
            <input
              placeholder="Ej: reclamo de un cliente, uso indebido…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-danger btn-sm" disabled={guardando} onClick={handleConfirmar}>
            {guardando ? 'Bloqueando…' : 'Confirmar bloqueo'}
          </button>
          <button className="btn btn-outline btn-sm" disabled={guardando} onClick={onCancelar}>Cancelar</button>
          {error && <div className="alert alert-error" style={{ margin: 0, flexBasis: '100%' }}>{error}</div>}
        </div>
        <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0 0 8px' }}>
          Bloquear cierra las sesiones abiertas de esta cuenta. El motivo solo se le muestra al dueño de la cuenta,
          y recién después de que ponga su contraseña correcta — nunca en un intento fallido.
        </p>
      </td>
    </tr>
  );
}

// Gestión de cuentas: cambiar el email o resetear la contraseña de
// cualquier usuario (alumno, profesor o admin), y su seguridad — activo/
// inactivo (alta-baja) y bloqueado (medida de seguridad, manual o
// automática por fuerza bruta — ver README "Seguridad de cuentas"). No hay
// autoservicio para editar email/contraseña todavía: es la única vía si
// alguien pierde acceso a su cuenta o hay que corregir un dato mal cargado.
// Para dar de alta profesores nuevos seguí usando "Profesores"; acá se
// editan cuentas que ya existen.
export default function AdminUsers() {
  const { user: yo } = useAdminAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rol, setRol] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [editandoId, setEditandoId] = useState(null);
  const [bloqueandoId, setBloqueandoId] = useState(null);
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

  async function toggleActivo(u) {
    setError('');
    try {
      const { user: actualizado } = await api.put(`/admin/users/${u.id}/activo`, { activo: !u.activo });
      setUsuarios((lista) => lista.map((x) => (x.id === u.id ? actualizado : x)));
      setMensaje(actualizado.activo ? 'Cuenta reactivada.' : 'Cuenta desactivada — se cerraron sus sesiones abiertas.');
      setTimeout(() => setMensaje(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmarBloqueo(userId, motivo) {
    const { user: actualizado } = await api.put(`/admin/users/${userId}/bloqueo`, { bloqueado: true, motivo });
    setUsuarios((lista) => lista.map((x) => (x.id === userId ? actualizado : x)));
    setBloqueandoId(null);
    setMensaje('Cuenta bloqueada — se cerraron sus sesiones abiertas.');
    setTimeout(() => setMensaje(''), 4000);
  }

  async function desbloquear(u) {
    setError('');
    try {
      const { user: actualizado } = await api.put(`/admin/users/${u.id}/bloqueo`, { bloqueado: false });
      setUsuarios((lista) => lista.map((x) => (x.id === u.id ? actualizado : x)));
      setMensaje('Cuenta desbloqueada.');
      setTimeout(() => setMensaje(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Usuarios</h1>
      <p className="text-muted">
        Editá el email o reseteá la contraseña de cualquier cuenta, desactivala (baja sin borrar nada) o bloqueala
        (medida de seguridad — también se puede activar sola por demasiados intentos fallidos de login, ver
        "Bloqueados"). Para ver o cerrar sus sesiones activas, andá a "Sesiones" — el link "Ver sesiones" de cada
        fila te lleva directo, filtrado a ese usuario.
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
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((u) => {
                const esUnoMismo = yo && String(yo.id) === String(u.id);
                if (editandoId === u.id) {
                  return (
                    <FilaEdicion
                      key={u.id}
                      user={u}
                      onGuardar={(patch) => guardarEdicion(u.id, patch)}
                      onCancelar={() => setEditandoId(null)}
                    />
                  );
                }
                if (bloqueandoId === u.id) {
                  return (
                    <FilaBloqueo
                      key={u.id}
                      user={u}
                      onConfirmar={(motivo) => confirmarBloqueo(u.id, motivo)}
                      onCancelar={() => setBloqueandoId(null)}
                    />
                  );
                }
                return (
                  <tr key={u.id}>
                    <td>{u.nombre} {u.apellido}</td>
                    <td>{u.email}</td>
                    <td><span className="badge">{u.rol}</span></td>
                    <td>{u.email_verificado ? '✓' : '—'}</td>
                    <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span>
                      {u.bloqueado && (
                        <span className="badge badge-danger" title={u.bloqueado_motivo || ''}>Bloqueado</span>
                      )}
                    </td>
                    <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditandoId(u.id)}>Editar</button>
                      <Link className="btn btn-outline btn-sm" to={`/admin-panel/logins?userId=${u.id}`}>Ver sesiones</Link>
                      <button
                        className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-primary'}`}
                        disabled={esUnoMismo}
                        title={esUnoMismo ? 'No podés desactivar tu propia cuenta' : undefined}
                        onClick={() => toggleActivo(u)}
                      >
                        {u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                      {u.bloqueado ? (
                        <button className="btn btn-outline btn-sm" onClick={() => desbloquear(u)}>Desbloquear</button>
                      ) : (
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={esUnoMismo}
                          title={esUnoMismo ? 'No podés bloquear tu propia cuenta' : undefined}
                          onClick={() => setBloqueandoId(u.id)}
                        >
                          Bloquear
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="text-muted">No hay usuarios que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
