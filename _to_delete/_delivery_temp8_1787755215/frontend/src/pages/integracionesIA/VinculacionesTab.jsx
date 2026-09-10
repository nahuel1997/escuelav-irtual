import { useState } from 'react';
import { api } from '../../api/client';

// Pestaña "Vinculaciones": una sección desplegable por IA (ChatGPT
// primero, después Claude y Gemini — mismo orden que el resto de "IA para
// ChatGPT/Claude/Gemini" del resto de la plataforma, ver CvBuilder.jsx).
// El instructivo de cada una lo carga el admin desde
// /admin-panel/ai-integraciones (HTML completo) — se muestra dentro de un
// <iframe sandbox> en vez de inyectarlo directo en la página: es
// contenido que escribió el admin, no el alumno, pero aun así no hace
// falta que corra JavaScript en el contexto de la sesión del alumno para
// mostrar una lista de pasos con un par de links — un iframe sandboxeado
// (sin scripts, sin acceso a esta página) da exactamente lo mismo visual
// sin abrir esa puerta. "allow-popups allow-popups-to-escape-sandbox" es
// lo único habilitado, para que los links a platform.openai.com/etc.
// puedan abrir en una pestaña nueva.
export default function VinculacionesTab({ proveedores, onActualizado }) {
  const [abierta, setAbierta] = useState(proveedores[0]?.clave || null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {proveedores.map((p) => (
        <ProveedorRow
          key={p.clave}
          proveedor={p}
          abierta={abierta === p.clave}
          onToggle={() => setAbierta(abierta === p.clave ? null : p.clave)}
          onActualizado={onActualizado}
        />
      ))}
    </div>
  );
}

function ProveedorRow({ proveedor, abierta, onToggle, onActualizado }) {
  const [apiKey, setApiKey] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [desvinculando, setDesvinculando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function vincular(e) {
    e.preventDefault();
    if (!apiKey.trim()) { setError('Pegá tu API key antes de vincular.'); return; }
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const { link } = await api.post(`/ai/vinculaciones/${proveedor.clave}`, { apiKey });
      onActualizado({ ...proveedor, vinculado: link.activo, apiKeyPreview: link.apiKeyPreview });
      setApiKey('');
      setMensaje('¡Listo! Tu cuenta quedó vinculada.');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function desvincular() {
    if (!window.confirm(`¿Desvincular tu cuenta de ${proveedor.nombre}? Tus chats guardados no se borran, pero vas a dejar de verlos hasta que la vuelvas a vincular.`)) return;
    setDesvinculando(true);
    setError('');
    try {
      await api.delete(`/ai/vinculaciones/${proveedor.clave}`);
      onActualizado({ ...proveedor, vinculado: false, apiKeyPreview: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setDesvinculando(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className={`badge ${proveedor.vinculado ? 'badge-success' : ''}`}>
          {proveedor.vinculado ? `Vinculada (${proveedor.apiKeyPreview})` : 'No vinculada'}
        </span>
        <strong style={{ flex: 1, minWidth: 160 }}>{proveedor.nombre}</strong>
        {proveedor.vinculado && (
          <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)' }} disabled={desvinculando} onClick={desvincular}>
            {desvinculando ? 'Desvinculando…' : 'Desvincular'}
          </button>
        )}
        <button type="button" className="btn btn-outline btn-sm" onClick={onToggle} aria-expanded={abierta}>
          {abierta ? 'Cerrar' : 'Ver cómo conectar'}
        </button>
      </div>

      {abierta && (
        <div style={{ marginTop: 16, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
          {proveedor.instructivoHtml ? (
            <iframe
              title={`instructivo-${proveedor.clave}`}
              srcDoc={`<base target="_blank"><body style="font-family:Inter,system-ui,sans-serif;font-size:14px;color:#1a1f26;margin:0;padding:2px;">${proveedor.instructivoHtml}</body>`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              style={{ width: '100%', height: 220, border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
            />
          ) : (
            <p className="text-muted">Todavía no hay instructivo cargado para esta IA.</p>
          )}

          {!proveedor.vinculado && (
            <form onSubmit={vincular} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 14 }}>
              <div className="field" style={{ flex: 1, minWidth: 240, marginBottom: 0 }}>
                <label>API key de {proveedor.nombre}</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Pegá acá tu API key" autoComplete="off" />
              </div>
              <button className="btn btn-accent" type="submit" disabled={guardando}>{guardando ? 'Vinculando…' : 'Vincular'}</button>
            </form>
          )}

          {(error || mensaje) && (
            <p style={{ fontSize: '0.85rem', color: error ? 'var(--color-danger)' : 'var(--color-success)', marginTop: 10 }}>
              {error || mensaje}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
