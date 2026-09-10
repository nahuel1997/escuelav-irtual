import { useEffect, useState } from 'react';
import { API_ORIGIN } from '../../../api/client';
import { HEADING_FONTS, BODY_FONTS } from '../../../config/fonts';
import { ZONAS_HORARIAS } from '../../../config/timezones';

// campo.opciones -> de qué lista sale el <select> de un campo tipo
// "seleccion". Se agregan acá a medida que aparecen (hoy: tipografías de
// título/texto y zona horaria) — evita el ternario en cascada que era
// antes de agregar la tercera lista.
const LISTAS_OPCIONES = {
  titulos: HEADING_FONTS,
  texto: BODY_FONTS,
  zonaHoraria: ZONAS_HORARIAS,
};

// Renderiza UN campo editable, según su tipo (texto/imagen/color/
// seleccion/boton). Lo reutilizan GeneralTab y PageTab para no duplicar
// esta lógica en cada pestaña.
export default function CampoField({ campo, valor, botones, onGuardar, onSubirImagen }) {
  const [local, setLocal] = useState(valor ?? '');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [mensajeEsError, setMensajeEsError] = useState(false);
  // Para imágenes: el archivo elegido en el <input type="file"> no se sube
  // solo, queda "pendiente" hasta que el admin aprieta "Guardar imagen".
  // Así queda claro con un botón y un estado (guardando / guardado / error)
  // si el cambio se aplicó o no, en vez de subir en silencio al elegir el
  // archivo.
  const [archivoPendiente, setArchivoPendiente] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Si el valor de afuera cambia (ej: recién terminó de cargar desde la
  // API), sincronizamos el buffer local.
  useEffect(() => { setLocal(valor ?? ''); }, [valor]);

  useEffect(() => {
    // Libera el object URL de la vista previa cuando se reemplaza o se
    // desmonta, para no dejar memoria colgada.
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  async function guardar(valorAGuardar) {
    setGuardando(true);
    setMensaje('');
    try {
      await onGuardar(valorAGuardar);
      setMensaje('Guardado');
      setMensajeEsError(false);
    } catch (err) {
      setMensaje(err.message);
      setMensajeEsError(true);
    } finally {
      setGuardando(false);
    }
  }

  function elegirArchivo(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArchivoPendiente(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMensaje('');
  }

  async function confirmarSubida() {
    if (!archivoPendiente) return;
    setSubiendo(true);
    setMensaje('');
    try {
      await onSubirImagen(archivoPendiente);
      setMensaje('Actualizado — el sitio público lo va a mostrar solo en unos segundos, sin F5');
      setMensajeEsError(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setArchivoPendiente(null);
      setPreviewUrl(null);
    } catch (err) {
      setMensaje(`No se pudo actualizar: ${err.message}`);
      setMensajeEsError(true);
    } finally {
      setSubiendo(false);
    }
  }

  function cancelarSeleccion() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setArchivoPendiente(null);
    setPreviewUrl(null);
    setMensaje('');
  }

  return (
    <div>
      <label style={{ fontWeight: 600, fontSize: '0.9rem', display: 'block', marginBottom: 6 }}>{campo.label}</label>

      {campo.tipo === 'texto' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {campo.textarea ? (
            <textarea rows={3} style={{ flex: 1 }} value={local} onChange={(e) => setLocal(e.target.value)} />
          ) : (
            <input style={{ flex: 1 }} value={local} onChange={(e) => setLocal(e.target.value)} />
          )}
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={() => guardar(local)}>
            {guardando ? '...' : 'Guardar'}
          </button>
        </div>
      )}

      {campo.tipo === 'color' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="color" value={local || '#ffffff'} onChange={(e) => setLocal(e.target.value)} style={{ width: 48, height: 38, padding: 2 }} />
          <input style={{ flex: 1, maxWidth: 140 }} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="#rrggbb" />
          <button className="btn btn-primary btn-sm" disabled={guardando} onClick={() => guardar(local)}>
            {guardando ? '...' : 'Guardar'}
          </button>
        </div>
      )}

      {campo.tipo === 'imagen' && (
        <div>
          {/* Vista previa del archivo recién elegido, si hay uno pendiente
              de guardar; si no, la imagen que ya está guardada. */}
          {previewUrl ? (
            <div>
              <img
                src={previewUrl}
                alt="Vista previa (todavía no guardada)"
                style={{ maxWidth: 220, borderRadius: 8, display: 'block', marginBottom: 4, border: '2px dashed var(--color-accent)', padding: 4 }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--color-accent)', margin: '0 0 8px' }}>Sin guardar todavía</p>
            </div>
          ) : (
            valor && (
              <img
                src={valor.startsWith('/uploads') ? `${API_ORIGIN}${valor}` : valor}
                alt={campo.label}
                style={{ maxWidth: 220, borderRadius: 8, display: 'block', marginBottom: 8 }}
              />
            )
          )}

          <input type="file" accept="image/*" onChange={(e) => e.target.files[0] && elegirArchivo(e.target.files[0])} />

          {/* Botón explícito debajo de la imagen: nada se sube solo al
              elegir el archivo, así queda claro cuándo se guardó o no. */}
          {archivoPendiente && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={subiendo} onClick={confirmarSubida}>
                {subiendo ? 'Guardando…' : 'Guardar imagen'}
              </button>
              <button className="btn btn-outline btn-sm" disabled={subiendo} onClick={cancelarSeleccion}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {campo.tipo === 'seleccion' && (
        <select
          value={local || campo.default}
          onChange={(e) => { setLocal(e.target.value); guardar(e.target.value); }}
        >
          {(LISTAS_OPCIONES[campo.opciones] || BODY_FONTS).map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
      )}

      {campo.tipo === 'boton' && (
        <div>
          <select
            value={local || ''}
            onChange={(e) => { setLocal(e.target.value); guardar(e.target.value); }}
          >
            <option value="">Sin asignar (usa el estilo por defecto del sitio)</option>
            {botones.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
          </select>
          {campo.soloColor && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              Este botón dispara una acción (enviar, comprar, ingresar): de la opción elegida solo se usa el color, el link queda fijo.
            </p>
          )}
          {botones.length === 0 && (
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
              Todavía no cargaste ninguna opción de botón — agregá una en la pestaña "Generales".
            </p>
          )}
        </div>
      )}

      {mensaje && (
        <p style={{ fontSize: '0.8rem', marginTop: 4, fontWeight: 600, color: mensajeEsError ? 'var(--color-danger, #c0392b)' : 'var(--color-success, #1a8a4a)' }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
