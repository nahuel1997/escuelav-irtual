import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CONTENT_PAGES } from '../../config/content';
import GeneralTab from './content/GeneralTab';
import PageTab from './content/PageTab';

// Panel para editar todo el contenido público del sitio, organizado en
// sub-pestañas por página (más "Generales" para lo que es transversal:
// logo, tipografía, SEO por defecto, navegación extra y el registro de
// botones). Cada campo se guarda contra PUT /api/admin/content/:clave.
// Para agregar un campo/página nueva, alcanza con sumarlo a
// src/config/content.js y leerlo en la página pública correspondiente con
// useContent().
export default function AdminContent() {
  const [tab, setTab] = useState('general');
  const [valores, setValores] = useState({});
  const [botones, setBotones] = useState([]);
  const [cargando, setCargando] = useState(true);

  function cargarContenido() {
    return api.get('/admin/content').then(({ content }) => {
      const map = {};
      content.forEach((c) => { map[c.clave] = c.valor; });
      setValores(map);
    });
  }

  function cargarBotones() {
    return api.get('/admin/botones').then((d) => setBotones(d.opciones));
  }

  useEffect(() => {
    Promise.all([cargarContenido(), cargarBotones()]).finally(() => setCargando(false));
  }, []);

  async function guardarCampo(clave, tipo, valor) {
    await api.put(`/admin/content/${clave}`, { tipo, valor });
    setValores((v) => ({ ...v, [clave]: valor }));
  }

  async function subirImagen(clave, file) {
    const formData = new FormData();
    formData.append('imagen', file);
    const { url } = await api.postForm('/admin/upload-imagen', formData);
    await guardarCampo(clave, 'imagen', url);
  }

  const paginaActual = CONTENT_PAGES.find((p) => p.id === tab);

  return (
    <div>
      <h1>Contenido del sitio</h1>
      <p className="text-muted">
        Los cambios quedan guardados al toque. El sitio público los va a mostrar solo, sin F5: al
        toque si esa pestaña está en foco, o apenas volvés a ella si la tenías de fondo.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
        {CONTENT_PAGES.map((p) => (
          <button
            key={p.id}
            className={`btn btn-sm ${tab === p.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="spinner-msg">Cargando…</div>
      ) : (
        <div style={{ marginTop: 24 }}>
          {tab === 'general' ? (
            <GeneralTab
              pagina={paginaActual}
              valores={valores}
              botones={botones}
              guardarCampo={guardarCampo}
              subirImagen={subirImagen}
              recargarBotones={cargarBotones}
            />
          ) : (
            <PageTab pagina={paginaActual} valores={valores} botones={botones} guardarCampo={guardarCampo} subirImagen={subirImagen} />
          )}
        </div>
      )}
    </div>
  );
}
