import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// Editor de los 3 instructivos de "Integraciones IA" (ChatGPT/Claude/
// Gemini) que ve el alumno al desplegar cada sección de la pestaña
// Vinculaciones (/panel-alumno/integraciones-ia) — mismo patrón que
// AdminCvTemplates.jsx: HTML editable + vista previa + activar/
// desactivar. No hay alta/baja: las 3 claves son fijas, ver
// backend/src/db/seeds/004_ai_integration_templates.js.
export default function AdminAiTemplates() {
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);

  function cargar() {
    return api.get('/admin/ai-templates')
      .then(({ plantillas }) => setPlantillas(plantillas))
      .catch((err) => setError(err.message));
  }

  useEffect(() => { cargar().finally(() => setCargando(false)); }, []);

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      <h1>Integraciones IA — instructivos</h1>
      <p className="text-muted">
        Este es el texto que ve el alumno al desplegar cada IA en la pestaña "Vinculaciones" de Integraciones IA —
        los pasos para sacar su propia API key y pegarla en el panel. Un instructivo desactivado deja esa sección
        vacía (la IA se puede seguir vinculando igual, solo no se muestra el paso a paso).
      </p>
      {error && <div className="alert alert-error">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {plantillas.map((p) => (
          <PlantillaRow
            key={p.clave}
            plantilla={p}
            abierta={abierta === p.clave}
            onToggle={() => setAbierta(abierta === p.clave ? null : p.clave)}
            onGuardada={(nueva) => setPlantillas((ps) => ps.map((x) => (x.clave === nueva.clave ? nueva : x)))}
          />
        ))}
      </div>
    </div>
  );
}

function PlantillaRow({ plantilla, abierta, onToggle, onGuardada }) {
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [html, setHtml] = useState(plantilla.instructivo_html);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [verVistaPrevia, setVerVistaPrevia] = useState(false);

  async function toggleActivo() {
    try {
      const { plantilla: actualizada } = await api.put(`/admin/ai-templates/${plantilla.clave}`, { activo: !plantilla.activo });
      onGuardada(actualizada);
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardar() {
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const { plantilla: actualizada } = await api.put(`/admin/ai-templates/${plantilla.clave}`, { nombre, instructivo_html: html });
      onGuardada(actualizada);
      setMensaje('Guardado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
          <input type="checkbox" checked={plantilla.activo} onChange={toggleActivo} />
          {plantilla.activo ? 'Activo' : 'Inactivo'}
        </label>
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong>{plantilla.nombre}</strong>
          <div className="text-muted" style={{ fontSize: '0.78rem' }}><code>{plantilla.clave}</code></div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onToggle}>{abierta ? 'Cerrar' : 'Editar'}</button>
      </div>

      {abierta && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className={`btn btn-sm ${verVistaPrevia ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVerVistaPrevia((v) => !v)}>
              {verVistaPrevia ? 'Ocultar vista previa' : 'Ver vista previa'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 280 }}>
              <label>Nombre (lo que ve el alumno)</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <label style={{ marginTop: 10 }}>Instructivo — HTML (pasos para sacar la API key + video; se muestra dentro de un iframe sandboxeado, así que podés pegar links, listas, un embed de YouTube/Vimeo, etc. — el sandbox permite que corra ese tipo de contenido, pero lo aísla en un origen propio sin acceso a esta página ni a la sesión del alumno)</label>
              <textarea
                rows={14}
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '0.8rem', minHeight: 260, resize: 'vertical' }}
              />
            </div>

            {verVistaPrevia && (
              <div style={{ flex: 1, minWidth: 280 }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6, display: 'block' }}>Vista previa</label>
                <iframe
                  title={`preview-${plantilla.clave}`}
                  srcDoc={`<base target="_blank"><body style="font-family:Inter,system-ui,sans-serif;font-size:14px;color:#1a1f26;margin:0;padding:8px;">${html}</body>`}
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-fullscreen"
                  style={{ height: 480, width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={guardar} disabled={guardando} style={{ alignSelf: 'flex-start' }}>
              {guardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {(mensaje || error) && (
              <p style={{ fontSize: '0.82rem', color: error ? 'var(--color-danger, #c0392b)' : '#1a8a4a', margin: 0 }}>
                {error || mensaje}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
