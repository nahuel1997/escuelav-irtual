import { useEffect, useState } from 'react';
import { api, guardarBlob } from '../../api/client';
import { formatFecha } from '../../utils/fecha';

const TIPOS = { bug: 'Error', mejora: 'Mejora', ok: 'Funciona bien' };

// Admin → Tester (portado de DBA24): entrar a la app como un alumno o
// profesor de prueba (cuenta nueva, marcada es_prueba) en otra pestaña, y
// anotar observaciones mientras se prueba — se exportan a PDF.
export default function AdminTester() {
  const [data, setData] = useState({ sesiones: [], observaciones: [] });
  const [obs, setObs] = useState({ sesionId: '', pantalla: '', tipo: 'bug', texto: '' });
  const [error, setError] = useState('');
  const [abriendo, setAbriendo] = useState('');

  const cargar = () => api.get('/admin/tester').then(setData).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, []);

  async function abrir(rol) {
    if (!window.confirm(`Se va a crear un ${rol} de prueba y abrir el sitio en otra pestaña con esa sesión. Si en este navegador tenías una sesión de alumno/profesor abierta, se reemplaza. ¿Seguimos?`)) return;
    setAbriendo(rol);
    setError('');
    try {
      const r = await api.post('/admin/tester/sesiones', { rol });
      // Misma app, mismo origen: la sesión del sitio vive en localStorage "token".
      localStorage.setItem('token', r.token);
      window.open('/', '_blank', 'noopener');
      setObs((o) => ({ ...o, sesionId: String(r.sesionId) }));
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAbriendo('');
    }
  }

  async function cerrar(id) {
    await api.post(`/admin/tester/sesiones/${id}/cerrar`, {});
    cargar();
  }

  async function anotar(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/admin/tester/observaciones', { ...obs, sesionId: obs.sesionId ? Number(obs.sesionId) : null });
      setObs({ ...obs, texto: '' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(id) {
    await api.delete(`/admin/tester/observaciones/${id}`);
    cargar();
  }

  async function pdf() {
    guardarBlob(await api.getBlob('/admin/tester/observaciones/pdf'), 'observaciones-tester.pdf');
  }

  return (
    <div>
      <h1 style={{ margin: 0 }}>Tester</h1>
      <p className="text-muted" style={{ margin: '4px 0 0' }}>
        Probá la app como la ve un alumno o un profesor, con una cuenta de prueba nueva. Al cerrar la sesión de prueba,
        la cuenta se desactiva. Lo que hagas con ella queda en la base marcado como de prueba.
      </p>
      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      <div className="card" style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={Boolean(abriendo)} onClick={() => abrir('alumno')}>{abriendo === 'alumno' ? 'Abriendo…' : 'Entrar como alumno de prueba'}</button>
        <button className="btn btn-primary" disabled={Boolean(abriendo)} onClick={() => abrir('profesor')}>{abriendo === 'profesor' ? 'Abriendo…' : 'Entrar como profesor de prueba'}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginTop: 16 }}>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0 }}>Sesiones de prueba</h3>
          <table><tbody>
            {data.sesiones.map((s) => (
              <tr key={s.id}>
                <td>#{s.id} <span className="badge">{s.rol}</span><div className="text-muted" style={{ fontSize: '0.78rem' }}>{s.cuenta_email}</div></td>
                <td className="text-muted" style={{ fontSize: '0.85rem' }}>{formatFecha(s.created_at)}</td>
                <td>{s.cerrada_en ? <span className="badge">Cerrada</span> : <button className="btn btn-outline btn-sm" onClick={() => cerrar(s.id)}>Cerrar</button>}</td>
              </tr>
            ))}
            {data.sesiones.length === 0 && <tr><td className="text-muted">Todavía no abriste ninguna.</td></tr>}
          </tbody></table>
        </div>

        <form className="card" style={{ margin: 0 }} onSubmit={anotar}>
          <h3 style={{ marginTop: 0 }}>Anotar una observación</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Sesión</label>
              <select value={obs.sesionId} onChange={(e) => setObs({ ...obs, sesionId: e.target.value })}>
                <option value="">(ninguna)</option>
                {data.sesiones.map((s) => <option key={s.id} value={s.id}>#{s.id} {s.rol}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Tipo</label>
              <select value={obs.tipo} onChange={(e) => setObs({ ...obs, tipo: e.target.value })}>
                {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 8, flex: 1, minWidth: 140 }}>
              <label>Pantalla</label>
              <input value={obs.pantalla} onChange={(e) => setObs({ ...obs, pantalla: e.target.value })} placeholder="/tienda" />
            </div>
          </div>
          <div className="field"><label>Qué viste</label><textarea rows={3} value={obs.texto} onChange={(e) => setObs({ ...obs, texto: e.target.value })} required /></div>
          <button className="btn btn-primary btn-sm">Guardar</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 16, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Observaciones</h3>
          <button className="btn btn-outline btn-sm" onClick={pdf} disabled={!data.observaciones.length}>Descargar PDF</button>
        </div>
        <table style={{ marginTop: 8 }}><tbody>
          {data.observaciones.map((o) => (
            <tr key={o.id}>
              <td className="text-muted" style={{ fontSize: '0.82rem' }}>{formatFecha(o.created_at)}</td>
              <td><span className={`badge ${o.tipo === 'bug' ? 'badge-danger' : o.tipo === 'ok' ? 'badge-success' : 'badge-warning'}`}>{TIPOS[o.tipo]}</span></td>
              <td><code>{o.pantalla || '—'}</code></td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{o.texto}</td>
              <td className="text-muted">{o.admin_nombre}</td>
              <td><button className="btn btn-outline btn-sm" onClick={() => borrar(o.id)} aria-label="Borrar observación">×</button></td>
            </tr>
          ))}
          {data.observaciones.length === 0 && <tr><td className="text-muted">Sin observaciones.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}
