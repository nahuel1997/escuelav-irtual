import { useEffect, useState } from 'react';
import { api } from '../../../api/client';

// Editor de las plantillas de mail: asunto, cuerpo (HTML completo del
// mail — no un fragmento, ver más abajo) y si está activa o no. "Probar"
// manda un mail real (o de prueba, según el modo de envío — ver banner
// arriba) con valores de ejemplo en cada variable, para ver cómo queda
// sin tener que disparar el flujo real (comprar un curso, pedir un
// turno, etc.).
export default function PlantillasTab() {
  const [plantillas, setPlantillas] = useState([]);
  const [modoEnvio, setModoEnvio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(null);

  function cargar() {
    return api.get('/admin/mails/plantillas')
      .then(({ plantillas, modoEnvio }) => { setPlantillas(plantillas); setModoEnvio(modoEnvio); })
      .catch((err) => setError(err.message));
  }

  useEffect(() => { cargar().finally(() => setCargando(false)); }, []);

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="alert" style={{ background: modoEnvio === 'smtp' ? '#e6f4ea' : '#fff4e0', color: modoEnvio === 'smtp' ? '#1a6b34' : '#8a5a00', border: `1px solid ${modoEnvio === 'smtp' ? '#a8d9b6' : '#f0d59a'}` }}>
        {modoEnvio === 'smtp'
          ? 'Modo de envío: proveedor real (SMTP configurado). Los mails salen de verdad.'
          : 'Modo de envío: prueba (Ethereal). No se manda ningún mail a casillas reales — cada envío queda en el Registro con un link para verlo. Configurá SMTP_HOST en backend/.env para pasar a un proveedor real.'}
      </div>

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

// Mismos valores de ejemplo que usa el backend para el botón "Probar"
// (ver mails.controller.js → testSend), para que la vista previa de acá
// se vea igual que el mail de prueba real.
function valorDeEjemplo(nombreVariable) {
  return nombreVariable.includes('link') ? '#' : `[Ejemplo de "${nombreVariable}"]`;
}

function renderPreview(texto, variablesDisponibles) {
  const nombres = (variablesDisponibles || '').split(',').map((v) => v.trim()).filter(Boolean);
  return String(texto || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, nombre) => {
    if (nombres.includes(nombre)) return valorDeEjemplo(nombre);
    return '';
  });
}

function PlantillaRow({ plantilla, abierta, onToggle, onGuardada }) {
  const [asunto, setAsunto] = useState(plantilla.asunto);
  const [cuerpo, setCuerpo] = useState(plantilla.cuerpo_html);
  const [guardando, setGuardando] = useState(false);
  const [probando, setProbando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [verVistaPrevia, setVerVistaPrevia] = useState(false);

  async function toggleActivo() {
    try {
      const { plantilla: actualizada } = await api.put(`/admin/mails/plantillas/${plantilla.clave}`, { activo: !plantilla.activo });
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
      const { plantilla: actualizada } = await api.put(`/admin/mails/plantillas/${plantilla.clave}`, { asunto, cuerpo_html: cuerpo });
      onGuardada(actualizada);
      setMensaje('Guardado.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function probar() {
    setProbando(true);
    setError('');
    setPreviewUrl('');
    try {
      const res = await api.post(`/admin/mails/plantillas/${plantilla.clave}/probar`, {});
      setMensaje(res.previewUrl ? 'Mail de prueba enviado.' : 'Mail de prueba enviado a tu casilla.');
      if (res.previewUrl) setPreviewUrl(res.previewUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setProbando(false);
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
          <label>Asunto</label>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} />
          <label style={{ marginTop: 10 }}>Cuerpo — HTML completo del mail (no un fragmento: podés escribir el documento entero, con estilos inline, tablas, lo que necesites)</label>
          <textarea
            rows={pantallaCompleta ? 28 : 14}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            style={{ fontFamily: 'monospace', fontSize: '0.8rem', flex: pantallaCompleta ? 1 : 'none', minHeight: pantallaCompleta ? 0 : 260, resize: 'vertical' }}
          />
        </div>

        {verVistaPrevia && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 280 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: 6 }}>Vista previa (con valores de ejemplo)</label>
            <p className="text-muted" style={{ fontSize: '0.78rem', margin: '0 0 6px' }}>
              Asunto: {renderPreview(asunto, plantilla.variables_disponibles)}
            </p>
            <iframe
              title={`preview-${plantilla.clave}`}
              srcDoc={renderPreview(cuerpo, plantilla.variables_disponibles)}
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
            {error || mensaje}{previewUrl && (
              <> — <a href={previewUrl} target="_blank" rel="noreferrer">ver el mail</a></>
            )}
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
        <button className="btn btn-outline btn-sm" onClick={probar} disabled={probando}>{probando ? 'Enviando…' : 'Probar'}</button>
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
