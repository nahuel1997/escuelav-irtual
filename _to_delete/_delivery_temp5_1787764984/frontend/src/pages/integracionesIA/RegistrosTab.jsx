import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Icon from '../../components/Icon';

function formatearFecha(iso) {
  try {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

// Pestaña "Registros": todo el historial de conversaciones — el backend
// (GET /ai/conversaciones sin filtro) ya devuelve SOLO las de IAs
// vinculadas hoy (ver ai.controller.js::listarConversaciones), así que acá
// no hace falta filtrar de nuevo: si una IA está desvinculada, sus chats
// simplemente no aparecen en esta lista hasta que se vuelva a vincular.
export default function RegistrosTab({ proveedores, onAbrirChat }) {
  const [conversaciones, setConversaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/ai/conversaciones')
      .then(({ conversaciones }) => setConversaciones(conversaciones))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  function nombreProveedor(clave) {
    return proveedores.find((p) => p.clave === clave)?.nombre || clave;
  }

  async function borrar(id) {
    if (!window.confirm('¿Borrar esta conversación? No se puede deshacer.')) return;
    try {
      await api.delete(`/ai/conversaciones/${id}`);
      setConversaciones((cs) => cs.filter((c) => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  if (cargando) return <div className="spinner-msg">Cargando…</div>;

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      {conversaciones.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p className="text-muted" style={{ margin: 0 }}>
            Todavía no tenés conversaciones guardadas de ninguna IA vinculada. Empezá una desde la pestaña "Chats".
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>IA</th>
                <th>Conversación</th>
                <th>Última actividad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {conversaciones.map((c) => (
                <tr key={c.id}>
                  <td><span className="badge">{nombreProveedor(c.proveedor)}</span></td>
                  <td>
                    {c.titulo}
                    {/* c.gpt_nombre viene del join en aiConversation.model.js — se
                        muestra igual aunque el GPT original ya se haya borrado o
                        editado (el nombre queda solo si el GPT sigue existiendo;
                        si lo borraron, gpt_id/gpt_nombre quedan null pero la
                        conversación y su sistema_prompt congelado siguen intactos). */}
                    {c.gpt_nombre && (
                      <span className="badge" style={{ marginLeft: 8, fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="bot" size={11} />
                        {c.gpt_nombre}
                      </span>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.85rem' }}>{formatearFecha(c.updated_at)}</td>
                  <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => onAbrirChat(c.proveedor, c.id)}>Abrir</button>
                    <button type="button" className="btn btn-outline btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => borrar(c.id)}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
