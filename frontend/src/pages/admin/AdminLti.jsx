import { useEffect, useState } from 'react';
import { api } from '../../api/client';

const vacio = { nombre: '', issuer: '', client_id: '', deployment_id: '', auth_login_url: '', auth_token_url: '', jwks_url: '', curso_id: '' };

// Alta de integraciones LMS reales vía LTI 1.3: esta app actúa de "Tool"
// (ver backend/src/controllers/lti.controller.js) y cada fila de acá es
// UN LMS externo (Moodle, Canvas, Google Classroom, o cualquiera
// compatible con LTI Advantage) conectado a UN curso puntual. Los 3 datos
// del recuadro de arriba (login/launch/jwks) son los que hay que cargar
// del OTRO lado, en el panel de administración del LMS, al registrar esta
// herramienta — y los del formulario de acá abajo son los que ESE LMS le
// da al admin cuando termina de registrarla.
export default function AdminLti() {
  const [info, setInfo] = useState(null);
  const [plataformas, setPlataformas] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [editando, setEditando] = useState(null); // id, 'nuevo', o null
  const [form, setForm] = useState(vacio);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState('');

  function cargar() {
    return Promise.all([
      api.get('/admin/lti/info'),
      api.get('/admin/lti/plataformas'),
      api.get('/admin/courses'),
    ]).then(([i, p, c]) => {
      setInfo(i);
      setPlataformas(p.plataformas);
      setCursos(c.courses);
    });
  }

  useEffect(() => { cargar(); }, []);

  function abrirNuevo() {
    setForm(vacio);
    setEditando('nuevo');
    setError('');
  }

  function abrirEdicion(p) {
    setForm({
      nombre: p.nombre, issuer: p.issuer, client_id: p.client_id, deployment_id: p.deployment_id,
      auth_login_url: p.auth_login_url, auth_token_url: p.auth_token_url, jwks_url: p.jwks_url, curso_id: p.curso_id,
    });
    setEditando(p.id);
    setError('');
  }

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editando === 'nuevo') await api.post('/admin/lti/plataformas', form);
      else await api.put(`/admin/lti/plataformas/${editando}`, form);
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleActivo(p) {
    await api.put(`/admin/lti/plataformas/${p.id}/activo`);
    await cargar();
  }

  async function borrar(p) {
    if (!window.confirm(`¿Borrar la integración "${p.nombre}"? Los alumnos que ya entraron por ahí mantienen su cuenta e inscripción, solo se corta la conexión con el LMS.`)) return;
    await api.delete(`/admin/lti/plataformas/${p.id}`);
    await cargar();
  }

  function copiar(texto, campo) {
    navigator.clipboard.writeText(texto);
    setCopiado(campo);
    setTimeout(() => setCopiado(''), 1500);
  }

  return (
    <div>
      <h1>Integraciones LMS (LTI 1.3)</h1>
      <p className="text-muted">
        Conectá esta plataforma a un LMS externo (Moodle, Canvas, Google Classroom o cualquiera compatible con LTI Advantage)
        para que un curso se lance directo desde adentro del LMS, con las notas de vuelta automáticas.
      </p>

      {info && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3>Datos para registrar esta herramienta en el LMS</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Cuando el admin del LMS externo dé de alta esta herramienta como "External Tool" LTI 1.3, le va a pedir estas 3 URLs.
          </p>
          {[
            ['OpenID Connect Login URL', info.openidLoginUrl],
            ['Launch URL / Redirect URI', info.launchUrl],
            ['Public JWKS URL (keyset)', info.jwksUrl],
          ].map(([label, valor]) => (
            <div key={label} className="field" style={{ marginBottom: 10 }}>
              <label>{label}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={valor} readOnly style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => copiar(valor, label)}>
                  {copiado === label ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      {editando ? (
        <form onSubmit={guardar} className="card" style={{ marginBottom: 20 }}>
          <h3>{editando === 'nuevo' ? 'Nueva integración' : 'Editar integración'}</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>
            Estos datos los da el LMS externo al registrar esta herramienta de su lado (issuer, client ID, deployment ID y sus
            3 URLs de OIDC/JWKS).
          </p>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field">
              <label>Nombre (para identificarla acá)</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Moodle Instituto X" required />
            </div>
            <div className="field">
              <label>Curso al que se conecta</label>
              <select value={form.curso_id} onChange={(e) => setForm({ ...form, curso_id: e.target.value })} required>
                <option value="">Elegir curso…</option>
                {cursos.map((c) => <option key={c.id} value={c.id}>{c.titulo}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Issuer (iss)</label>
              <input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="https://mi-lms.ejemplo.com" required />
            </div>
            <div className="field">
              <label>Client ID</label>
              <input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} required />
            </div>
            <div className="field">
              <label>Deployment ID</label>
              <input value={form.deployment_id} onChange={(e) => setForm({ ...form, deployment_id: e.target.value })} required />
            </div>
          </div>
          <div className="field">
            <label>OIDC Auth Login URL de la plataforma</label>
            <input value={form.auth_login_url} onChange={(e) => setForm({ ...form, auth_login_url: e.target.value })} required />
          </div>
          <div className="field">
            <label>Token URL de la plataforma (para AGS)</label>
            <input value={form.auth_token_url} onChange={(e) => setForm({ ...form, auth_token_url: e.target.value })} required />
          </div>
          <div className="field">
            <label>JWKS URL de la plataforma</label>
            <input value={form.jwks_url} onChange={(e) => setForm({ ...form, jwks_url: e.target.value })} required />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="btn btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className="btn btn-primary" onClick={abrirNuevo} style={{ marginBottom: 20 }}>+ Nueva integración</button>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr><th>Nombre</th><th>Issuer</th><th>Curso</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {plataformas.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{p.issuer}</td>
                <td>{p.curso_titulo}</td>
                <td><span className={`badge ${p.activo ? 'badge-success' : ''}`}>{p.activo ? 'Activa' : 'Desactivada'}</span></td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" onClick={() => abrirEdicion(p)}>Editar</button>
                  <button className="btn btn-outline btn-sm" onClick={() => toggleActivo(p)}>{p.activo ? 'Desactivar' : 'Activar'}</button>
                  <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => borrar(p)}>Borrar</button>
                </td>
              </tr>
            ))}
            {plataformas.length === 0 && <tr><td colSpan={5} className="text-muted">Todavía no hay ninguna integración cargada.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
