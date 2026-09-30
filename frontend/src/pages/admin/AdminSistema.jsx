import { useEffect, useState } from 'react';
import { api, guardarBlob, API_URL } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

function ListaBlanca({ seccion, admins, listaVacia, onCambio }) {
  const [usuarios, setUsuarios] = useState([]);
  const [elegido, setElegido] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.get('/admin/users?rol=admin').then((d) => setUsuarios(d.users)); }, []);

  async function agregar() {
    setError('');
    try {
      await api.post(`/admin/listas/${seccion}/admins`, { userId: Number(elegido) });
      setElegido('');
      onCambio();
    } catch (e) {
      setError(e.message);
    }
  }
  async function quitar(id) {
    setError('');
    try {
      await api.delete(`/admin/listas/${seccion}/admins/${id}`);
      onCambio();
    } catch (e) {
      setError(e.message);
    }
  }
  const disponibles = usuarios.filter((u) => !admins.some((a) => a.user_id === u.id));

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Quién puede entrar acá</h3>
      {listaVacia && <div className="alert alert-error">La lista está vacía: por ahora cualquier admin puede entrar. Agregá a quienes corresponda y a partir de ahí solo entran ellos.</div>}
      {error && <div className="alert alert-error">{error}</div>}
      <table><tbody>
        {admins.map((a) => <tr key={a.id}><td>{a.nombre} {a.apellido}</td><td className="text-muted">{a.email}</td><td className="text-muted">desde {formatFecha(a.created_at)}</td><td><button className="btn btn-outline btn-sm" onClick={() => quitar(a.id)}>Quitar</button></td></tr>)}
      </tbody></table>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <select value={elegido} onChange={(e) => setElegido(e.target.value)}>
          <option value="">Elegí un admin…</option>
          {disponibles.map((u) => <option key={u.id} value={u.id}>{u.nombre} {u.apellido} ({u.email})</option>)}
        </select>
        <button className="btn btn-outline btn-sm" disabled={!elegido} onClick={agregar}>Agregar</button>
      </div>
    </div>
  );
}

function Backups() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [bajando, setBajando] = useState('');
  const cargar = () => api.get('/admin/backups').then(setData).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function descargar(tipo) {
    setBajando(tipo);
    setError('');
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      const nombre = tipo === 'db' ? `escuela-base-${fecha}.${data.motor === 'pg' ? 'sql' : 'sqlite3'}` : `escuela-proyecto-${fecha}.tar.gz`;
      guardarBlob(await api.getBlob(`/admin/backups/${tipo}`), nombre);
    } catch (e) {
      setError(e.message);
    } finally {
      setBajando('');
    }
  }

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="text-muted">Cargando…</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ margin: 0 }}>
        <h3 style={{ marginTop: 0 }}>Descargar backup</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={Boolean(bajando)} onClick={() => descargar('db')}>{bajando === 'db' ? 'Generando…' : `Base de datos (${data.motor === 'pg' ? 'pg_dump' : 'SQLite'})`}</button>
          <button className="btn btn-outline" disabled={Boolean(bajando)} onClick={() => descargar('proyecto')}>{bajando === 'proyecto' ? 'Empaquetando…' : 'Código del proyecto (.tar.gz)'}</button>
        </div>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 10 }}>El backup del proyecto NO incluye: {data.excluidos.join(', ')}. El <code>.env</code> se respalda aparte, a mano.</p>
      </div>
      <ListaBlanca seccion="backups" admins={data.admins} listaVacia={data.listaVacia} onCambio={cargar} />
    </div>
  );
}

function Actualizaciones() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [salida, setSalida] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const cargar = () => api.get('/admin/actualizaciones').then(setData).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function diagnostico(tipo) {
    setTrabajando(true);
    try {
      const r = await api.post(`/admin/actualizaciones/diagnostico/${tipo}`, {});
      setSalida(`## ${r.titulo}\n${r.output}`);
    } catch (e) {
      setSalida(`✗ ${e.message}`);
    } finally {
      setTrabajando(false);
    }
  }

  async function verPendientes() {
    setTrabajando(true);
    try {
      const r = await api.post('/admin/actualizaciones/ver-pendientes', {});
      setSalida(r.ok ? (r.commits.length ? `Hay ${r.commits.length} cambio(s) para bajar:\n${r.commits.join('\n')}` : 'Ya está todo al día.') : `✗ ${r.error}`);
    } catch (e) {
      setSalida(`✗ ${e.message}`);
    } finally {
      setTrabajando(false);
    }
  }

  // La actualización manda la salida en vivo: se lee por partes.
  async function actualizar() {
    if (!window.confirm('¿Actualizar ahora? Baja el código nuevo, instala dependencias, corre migraciones y reinicia. Conviene hacer un backup antes.')) return;
    setTrabajando(true);
    setSalida('');
    try {
      const res = await fetch(`${API_URL}/admin/actualizaciones/actualizar`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Error ${res.status}`);
      }
      const lector = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        setSalida((s) => s + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      setSalida((s) => `${s}\n✗ ${e.message}`);
    } finally {
      setTrabajando(false);
      cargar();
    }
  }

  if (error && !data) return <div className="alert alert-error">{error}</div>;
  if (!data) return <p className="text-muted">Cargando…</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ margin: 0 }}>
        <h3 style={{ marginTop: 0 }}>Código instalado</h3>
        {!data.esRepositorio ? <div className="alert alert-error">La carpeta del proyecto no es un repositorio git (o git no está instalado): no se puede actualizar desde acá.</div> : (
          <p>Rama <strong>{data.rama}</strong> · último cambio: {data.ultimoCommit}</p>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" disabled={trabajando} onClick={() => diagnostico('estado')}>git status</button>
          <button className="btn btn-outline btn-sm" disabled={trabajando} onClick={() => diagnostico('log')}>Últimos cambios</button>
          <button className="btn btn-outline btn-sm" disabled={trabajando} onClick={() => diagnostico('versiones')}>Node / npm</button>
          <button className="btn btn-outline btn-sm" disabled={trabajando} onClick={() => diagnostico('migraciones')}>Migraciones</button>
          <button className="btn btn-outline btn-sm" disabled={trabajando || !data.esRepositorio} onClick={verPendientes}>Ver si hay cambios nuevos</button>
          <button className="btn btn-danger btn-sm" disabled={trabajando || !data.esRepositorio} onClick={actualizar}>Actualizar ahora</button>
        </div>
        {salida && <pre style={{ background: '#0f1720', color: '#d6e2ee', padding: 12, borderRadius: 8, marginTop: 12, maxHeight: 420, overflow: 'auto', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{salida}</pre>}
      </div>
      <ListaBlanca seccion="actualizaciones" admins={data.admins} listaVacia={data.listaVacia} onCambio={cargar} />
    </div>
  );
}

// Admin → Sistema: Backups y Actualizaciones, cada una con su propia lista
// blanca de admins (tener acceso a una no da acceso a la otra).
export default function AdminSistema() {
  const [tab, setTab] = useState('backups');
  return (
    <div>
      <h1 style={{ margin: 0 }}>Sistema</h1>
      <div style={{ display: 'flex', gap: 6, marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
        <button className={`btn btn-sm ${tab === 'backups' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('backups')}>Backups</button>
        <button className={`btn btn-sm ${tab === 'actualizaciones' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('actualizaciones')}>Actualizaciones</button>
      </div>
      <div style={{ marginTop: 16 }}>{tab === 'backups' ? <Backups /> : <Actualizaciones />}</div>
    </div>
  );
}
