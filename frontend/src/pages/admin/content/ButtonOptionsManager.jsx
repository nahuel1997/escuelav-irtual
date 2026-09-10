import { useState } from 'react';
import { api } from '../../../api/client';

// Registro global de estilos de botón ("Opción N"): fondo, color de texto
// y link. Después, en cada pestaña de página, se elige qué opción usa
// cada botón puntual (ver CampoField.jsx, tipo "boton").
export default function ButtonOptionsManager({ botones, onCambio }) {
  const [nuevo, setNuevo] = useState({ color_fondo: '#16324a', color_texto: '#ffffff', link: '/' });
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');

  async function crear(e) {
    e.preventDefault();
    setCreando(true);
    setError('');
    try {
      await api.post('/admin/botones', nuevo);
      setNuevo({ color_fondo: '#16324a', color_texto: '#ffffff', link: '/' });
      await onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function guardarFila(boton) {
    await api.put(`/admin/botones/${boton.id}`, { color_fondo: boton.color_fondo, color_texto: boton.color_texto, link: boton.link });
    await onCambio();
  }

  async function borrar(id) {
    await api.delete(`/admin/botones/${id}`);
    await onCambio();
  }

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={crear} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Color de fondo</label>
          <input type="color" value={nuevo.color_fondo} onChange={(e) => setNuevo({ ...nuevo, color_fondo: e.target.value })} style={{ width: 48, height: 38, padding: 2 }} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Color de texto</label>
          <input type="color" value={nuevo.color_texto} onChange={(e) => setNuevo({ ...nuevo, color_texto: e.target.value })} style={{ width: 48, height: 38, padding: 2 }} />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
          <label>Link de destino</label>
          <input value={nuevo.link} onChange={(e) => setNuevo({ ...nuevo, link: e.target.value })} required />
        </div>
        {/* Vista previa en vivo: se arma con los colores tipeados, antes de
            guardar nada — así se ve cómo va a quedar el botón sin tener que
            crear la opción primero para probarla. */}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Vista previa</label>
          <BotonPreview colorFondo={nuevo.color_fondo} colorTexto={nuevo.color_texto} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={creando}>{creando ? '...' : 'Agregar opción'}</button>
      </form>

      <table>
        <thead><tr><th>Opción</th><th>Fondo</th><th>Texto</th><th>Link</th><th>Vista previa</th><th></th></tr></thead>
        <tbody>
          {botones.map((b) => (
            <FilaBoton key={b.id} boton={b} onGuardar={guardarFila} onBorrar={borrar} />
          ))}
          {botones.length === 0 && <tr><td colSpan={6} className="text-muted">Todavía no cargaste ninguna opción de botón.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// Botón "de mentira", solo para mostrar cómo se ve la combinación de
// colores — no dispara ninguna acción ni navega a ningún lado.
function BotonPreview({ colorFondo, colorTexto }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '8px 16px',
        borderRadius: 6,
        fontSize: '0.85rem',
        fontWeight: 600,
        background: colorFondo || '#16324a',
        color: colorTexto || '#ffffff',
        whiteSpace: 'nowrap',
      }}
    >
      Botón
    </span>
  );
}

function FilaBoton({ boton, onGuardar, onBorrar }) {
  const [local, setLocal] = useState(boton);

  return (
    <tr>
      <td><strong>{boton.nombre}</strong></td>
      <td><input type="color" value={local.color_fondo} onChange={(e) => setLocal({ ...local, color_fondo: e.target.value })} style={{ width: 40, height: 32, padding: 1 }} /></td>
      <td><input type="color" value={local.color_texto} onChange={(e) => setLocal({ ...local, color_texto: e.target.value })} style={{ width: 40, height: 32, padding: 1 }} /></td>
      <td><input value={local.link} onChange={(e) => setLocal({ ...local, link: e.target.value })} style={{ minWidth: 160 }} /></td>
      {/* Refleja `local` (lo que se está tipeando), no `boton` (lo guardado
          en la última vez) — por eso se actualiza al toque al cambiar
          cualquiera de los dos colores, sin esperar a apretar "Guardar". */}
      <td><BotonPreview colorFondo={local.color_fondo} colorTexto={local.color_texto} /></td>
      <td style={{ display: 'flex', gap: 6, whiteSpace: 'nowrap' }}>
        <button className="btn btn-outline btn-sm" onClick={() => onGuardar(local)}>Guardar</button>
        <button className="btn btn-danger btn-sm" onClick={() => onBorrar(boton.id)}>Eliminar</button>
      </td>
    </tr>
  );
}
