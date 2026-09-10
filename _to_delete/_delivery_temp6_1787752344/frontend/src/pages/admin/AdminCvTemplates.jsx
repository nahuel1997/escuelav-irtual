import { useEffect, useState } from 'react';
import { api } from '../../api/client';

// Editor de las 3 plantillas de "CV para IA" (ChatGPT/Claude/Gemini) que
// arma el Creador de CV (/cv → sección "Generar CV para IA"). Mismo
// patrón que PlantillasTab.jsx (mails): HTML completo editable + lista de
// variables disponibles + vista previa con valores de ejemplo + activar/
// desactivar. No hay "Probar" (no manda nada) ni alta/baja de plantillas:
// las 3 claves (chatgpt/claude/gemini) son fijas, ver
// backend/src/db/seeds/003_cv_ai_templates.js.
export default function AdminCvTemplates() {
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);

  function cargar() {
    return api.get('/admin/cv-templates')
      .then(({ plantillas }) => setPlantillas(plantillas))
      .catch((err) => setError(err.message));
  }

  useEffect(() => { cargar().finally(() => setCargando(false)); }, []);

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      <h1>CV para IA — plantillas</h1>
      <p className="text-muted">
        Estas 3 plantillas son el HTML completo que arma el Creador de CV (/cv) cuando un alumno genera su "CV para
        IA" para ChatGPT, Claude o Gemini — ver "Sandbox de orquestación de agentes" y "Creador de CV" en el README
        para el criterio general. Una plantilla desactivada no aparece como opción en /cv.
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

// Mismos valores de ejemplo "legibles" que usa PlantillasTab.jsx para la
// vista previa de mails — acá no hay botón "Probar" (nada se manda), así
// que esto es lo único que le da al admin una idea de cómo queda.
function valorDeEjemplo(nombreVariable) {
  if (nombreVariable === 'nombreCompleto') return 'Ana Gómez';
  if (nombreVariable === 'destino') return 'ChatGPT';
  if (nombreVariable === 'fechaGeneracion') return new Date().toLocaleDateString('es-AR');
  if (nombreVariable.endsWith('Html')) return `<ul><li>[Ejemplo de "${nombreVariable}"]</li></ul>`;
  return `[Ejemplo de "${nombreVariable}"]`;
}

function renderPreview(texto, variablesDisponibles) {
  const nombres = (variablesDisponibles || '').split(',').map((v) => v.trim()).filter(Boolean);
  return String(texto || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, nombre) => {
    if (nombres.includes(nombre)) return valorDeEjemplo(nombre);
    return '';
  });
}

function PlantillaRow({ plantilla, abierta, onToggle, onGuardada }) {
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [html, setHtml] = useState(plantilla.html);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [verVistaPrevia, setVerVistaPrevia] = useState(false);

  async function toggleActivo() {
    try {
      const { plantilla: actualizada } = await api.put(`/admin/cv-templates/${plantilla.clave}`, { activo: !plantilla.activo });
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
      const { plantilla: actualizada } = await api.put(`/admin/cv-templates/${plantilla.clave}`, { nombre, html });
      onGuardada(actualizada);
      setMensaje('Guardado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const editor = (
    <div style={{ marginTop: pantallaCompleta ? 0 : 12, borderTop: pantallaCompleta ? 'none' : '1px solid var(--color-border)', paddingTop: pantallaCompleta ? 0 : 12, display: 'flex', flexDirection: 'column', gap: 10, height: pantallaCompleta ? '100%' : 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <p className="text-muted" style={{ fontSize: '0.78rem', margin: 0 }}>
          Variables disponibles: {plantilla.variables_disponibles.split(',').map((v) => `{{${v.trim()}}}`).join(', ')}
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className={`btn btn-sm ${verVistaPrevia ? 'btn-primary' : 'btn-outline'}`} onClick={() => setVerVistaPrevia((v) => !v)}>
            {verVistaPrevia ? 'Ocultar vista previa' : 'Ver vista previa'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPantallaCompleta((v) => !v)}>
            {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: pantallaCompleta ? 1 : 'none', minHeight: 0, flexWrap: pantallaCompleta ? 'nowrap' : 'wrap' }}>
        <div className="field" style={{ marginBottom: 0, flex: verVistaPrevia && pantallaCompleta ? '0 0 50%' : 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <label>Nombre (lo que ve el alumno en el desplegable de /cv)</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <label style={{ marginTop: 10 }}>HTML — documento completo del CV (no un fragmento: podés escribir el documento entero, con estilos inline, lo que necesites)</label>
          <textarea
            rows={pantallaCompleta ? 28 : 14}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: pantallaCompleta ? 1 : 'none', minHeight: pantallaCompleta ? 0 : 260, resize: 'vertical' }}
          />
        </div>

        {verVistaPrevia && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 280 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Vista previa (con valores de ejemplo)</label>
            <iframe
              title={`preview-${plantilla.clave}`}
              srcDoc={renderPreview(html, plantilla.variables_disponibles)}
              sandbox=""
              style={{ flex: pantallaCompleta ? 1 : 'none', height: pantallaCompleta ? 'auto' : 420, width: '100%', border: '1.5px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
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
  );

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
          <input type="checkbox" checked={plantilla.activo} onChange={toggleActivo} />
          {plantilla.activo ? 'Activa' : 'Inactiva'}
        </label>
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong>{plantilla.nombre}</strong>
          <div className="text-muted" style={{ fontSize: '0.78rem' }}><code>{plantilla.clave}</code></div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onToggle}>{abierta ? 'Cerrar' : 'Editar'}</button>
      </div>

      {abierta && !pantallaCompleta && editor}

      {abierta && pantallaCompleta && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 1000, padding: 20, display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flex: '0 0 auto' }}>
            <strong>{plantilla.nombre} — <code style={{ fontWeight: 400 }}>{plantilla.clave}</code></strong>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            {editor}
          </div>
        </div>
      )}
    </div>
  );
}
