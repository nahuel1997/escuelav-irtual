import { useState } from 'react';
import { api } from '../api/client';
import { useContent, resolveButton } from '../hooks/useContent';
import { useSeo } from '../hooks/useSeo';

// Página de contacto: formulario + bloque de datos de contacto sobre fondo
// oscuro, replicando la estructura que usa aiviento.com en su sección de
// contacto (email, teléfono, ubicación, y el formulario en sí). Esos 3
// datos son editables desde /admin-panel/contenido.
export default function Contact() {
  const { values: content, buttons } = useContent();
  useSeo(content, 'contacto', 'Contacto');
  const botonEnviar = resolveButton(buttons, content, 'contacto.boton_enviar');
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', mensaje: '' });
  const [estado, setEstado] = useState({ enviando: false, ok: false, error: '' });

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setEstado({ enviando: true, ok: false, error: '' });
    try {
      await api.post('/contact', form, { auth: false });
      setEstado({ enviando: false, ok: true, error: '' });
      setForm({ nombre: '', email: '', telefono: '', mensaje: '' });
    } catch (err) {
      setEstado({ enviando: false, ok: false, error: err.message });
    }
  }

  return (
    <section className="section-dark" style={{ minHeight: '80vh', padding: '64px 0', background: content['contacto.color_fondo'] || undefined }}>
      <div className="container">
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div>
            <h1>Hablemos</h1>
            <p style={{ color: '#c3ccd6' }}>
              ¿Tenés dudas sobre un curso, la plataforma o querés proponer un
              programa nuevo? Escribinos y te respondemos a la brevedad.
            </p>
            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <strong>Email</strong>
                <p style={{ color: '#c3ccd6', margin: 0 }}>{content['contacto.email']}</p>
              </div>
              <div>
                <strong>Teléfono / WhatsApp</strong>
                <p style={{ color: '#c3ccd6', margin: 0 }}>{content['contacto.telefono']}</p>
              </div>
              <div>
                <strong>Ubicación</strong>
                <p style={{ color: '#c3ccd6', margin: 0 }}>{content['contacto.ubicacion']}</p>
              </div>
            </div>
          </div>

          {/* Tarjeta un poco más clara que el fondo de la sección (que ahora
              es negro puro por defecto, ver contacto.color_fondo) para que
              el formulario se note como una superficie propia — mismo
              criterio de "elevar" una tarjeta sobre fondo oscuro que usa
              aiviento.com, con gris oscuro en vez de azul para no
              desentonar con la paleta negro/blanco/verde lima. */}
          <form onSubmit={handleSubmit} className="card" style={{ background: '#141414' }}>
            {estado.ok && <div className="alert alert-success">¡Gracias! Recibimos tu mensaje, te vamos a responder pronto.</div>}
            {estado.error && <div className="alert alert-error">{estado.error}</div>}

            <div className="field">
              <label htmlFor="nombre" style={{ color: '#fff' }}>Nombre</label>
              <input id="nombre" name="nombre" value={form.nombre} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="email" style={{ color: '#fff' }}>Email</label>
              <input id="email" type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="field">
              <label htmlFor="telefono" style={{ color: '#fff' }}>Teléfono (opcional)</label>
              <input id="telefono" name="telefono" value={form.telefono} onChange={handleChange} />
            </div>
            <div className="field">
              <label htmlFor="mensaje" style={{ color: '#fff' }}>Mensaje</label>
              <textarea id="mensaje" name="mensaje" rows={5} value={form.mensaje} onChange={handleChange} required />
            </div>
            <button
              type="submit"
              className="btn btn-accent"
              disabled={estado.enviando}
              style={botonEnviar ? { background: botonEnviar.color_fondo, color: botonEnviar.color_texto } : undefined}
            >
              {estado.enviando ? 'Enviando…' : 'Enviar mensaje'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
