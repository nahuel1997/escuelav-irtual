import { useEffect, useState } from 'react';
import { api } from '../../../api/client';

// Umbrales de los mails automáticos (días de inactividad, horas de
// carrito abandonado, minutos de anticipación del recordatorio de turno).
// Guardado en app_settings — mismo patrón que el contenido del sitio, sin
// necesitar un deploy para ajustar un número.
export default function ConfiguracionTab() {
  const [settings, setSettings] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/mails/configuracion')
      .then(({ settings }) => setSettings(settings))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {settings.map((s) => (
          <SettingRow key={s.clave} setting={s} onGuardado={(actualizado) => setSettings((ss) => ss.map((x) => (x.clave === actualizado.clave ? actualizado : x)))} />
        ))}
      </div>
    </div>
  );
}

function SettingRow({ setting, onGuardado }) {
  const [valor, setValor] = useState(setting.valor);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  async function guardar() {
    setGuardando(true);
    setError('');
    setOk(false);
    try {
      const { setting: actualizado } = await api.put(`/admin/mails/configuracion/${setting.clave}`, { valor });
      onGuardado(actualizado);
      setOk(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <strong>{setting.descripcion || setting.clave}</strong>
        <div className="text-muted" style={{ fontSize: '0.78rem' }}><code>{setting.clave}</code></div>
      </div>
      <div className="field" style={{ marginBottom: 0 }}>
        <input style={{ width: 100 }} value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <button className="btn btn-outline btn-sm" onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      {ok && <span style={{ color: '#1a8a4a', fontSize: '0.8rem' }}>Guardado</span>}
      {error && <span style={{ color: 'var(--color-danger, #c0392b)', fontSize: '0.8rem' }}>{error}</span>}
    </div>
  );
}
