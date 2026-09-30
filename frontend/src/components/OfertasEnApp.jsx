import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { API_ORIGIN, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CuentaRegresiva from './CuentaRegresiva';

const CLAVE_CERRADAS = 'ofertas_cerradas';

function leerCerradas() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE_CERRADAS) || '[]'); } catch { return []; }
}

function visitanteId() {
  try { return localStorage.getItem('visitante_id') || undefined; } catch { return undefined; }
}

function token() {
  try { return localStorage.getItem('token'); } catch { return null; }
}

function evento(id, tipo) {
  const t = token();
  fetch(`${API_URL}/ofertas/${id}/evento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ tipo, visitante: visitanteId() }),
    keepalive: true,
  }).catch(() => {});
}

const formatPrecio = (p) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(p);
const imagen = (url) => (url && url.startsWith('/uploads') ? `${API_ORIGIN}${url}` : url);

function Boton({ oferta, onClick, estilo }) {
  if (!oferta.boton_url) return null;
  const texto = oferta.boton_texto || 'Ver oferta';
  const props = { onClick, className: 'btn btn-sm', style: { background: oferta.color_texto, color: oferta.color_fondo, border: 'none', ...estilo } };
  return oferta.boton_url.startsWith('/')
    ? <Link to={oferta.boton_url} {...props}>{texto}</Link>
    : <a href={oferta.boton_url} target="_blank" rel="noopener noreferrer" {...props}>{texto}</a>;
}

function Precio({ curso }) {
  if (!curso || curso.precioOferta === curso.precio) return null;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <s style={{ opacity: 0.7 }}>{formatPrecio(curso.precio)}</s> <strong>{formatPrecio(curso.precioOferta)}</strong>
    </span>
  );
}

// Ofertas en la app (Admin → Ofertas en la app): barra arriba de todo,
// banner arriba del contenido o pop-up (una vez por sesión), con cuenta
// regresiva hasta que termina la oferta. Se muestran según el público
// (visitantes, alumnos, profesores); el admin y soporte no las ven. Se
// registran vistas, clicks y cierres para las estadísticas.
export default function OfertasEnApp() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [ofertas, setOfertas] = useState([]);
  const [desfase, setDesfase] = useState(0);
  const [cerradas, setCerradas] = useState(leerCerradas);

  const cargar = useCallback(() => {
    const t = token();
    fetch(`${API_URL}/ofertas/activas`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then((r) => (r.ok ? r.json() : { ofertas: [] }))
      .then((d) => {
        setOfertas(d.ofertas || []);
        if (d.ahora) setDesfase(new Date(d.ahora).getTime() - Date.now());
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [cargar, user?.id]);

  const visibles = useMemo(() => ofertas.filter((o) => !cerradas.includes(o.id)), [ofertas, cerradas]);

  // Una "vista" por oferta y por sesión.
  useEffect(() => {
    let vistas = [];
    try { vistas = JSON.parse(sessionStorage.getItem('ofertas_vistas') || '[]'); } catch { vistas = []; }
    const nuevas = visibles.filter((o) => !vistas.includes(o.id));
    nuevas.forEach((o) => evento(o.id, 'vista'));
    if (nuevas.length) {
      try { sessionStorage.setItem('ofertas_vistas', JSON.stringify([...vistas, ...nuevas.map((o) => o.id)])); } catch { /* sin storage */ }
    }
  }, [visibles]);

  function cerrar(o) {
    evento(o.id, 'cerrada');
    const nuevas = [...cerradas, o.id];
    setCerradas(nuevas);
    try { sessionStorage.setItem(CLAVE_CERRADAS, JSON.stringify(nuevas)); } catch { /* sin storage */ }
  }

  const quitarVencida = useCallback((id) => setOfertas((l) => l.filter((o) => o.id !== id)), []);

  if (pathname.startsWith('/admin-panel') || pathname.startsWith('/soporte')) return null;
  const barra = visibles.find((o) => o.tipo === 'barra');
  const banner = visibles.find((o) => o.tipo === 'banner');
  const popup = visibles.find((o) => o.tipo === 'popup');

  return (
    <>
      {barra && (
        <div role="region" aria-label="Oferta" style={{ background: barra.color_fondo, color: barra.color_texto, padding: '8px 16px', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 40, fontSize: '0.92rem' }}>
          <strong>{barra.titulo}</strong>
          {barra.mensaje && <span>{barra.mensaje}</span>}
          <Precio curso={barra.curso} />
          {barra.mostrar_contador && <CuentaRegresiva hasta={barra.termina_en} desfaseMs={desfase} onTermina={() => quitarVencida(barra.id)} />}
          <Boton oferta={barra} onClick={() => evento(barra.id, 'click')} />
          <button type="button" onClick={() => cerrar(barra)} aria-label="Cerrar oferta" style={{ background: 'none', border: 'none', color: barra.color_texto, fontSize: '1.1rem', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {banner && (
        <div className="container" style={{ marginTop: 16 }}>
          <div role="region" aria-label="Oferta" style={{ background: banner.color_fondo, color: banner.color_texto, borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
            {banner.imagen_url && <img src={imagen(banner.imagen_url)} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8 }} />}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{banner.titulo}</div>
              {banner.mensaje && <div>{banner.mensaje}</div>}
              <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Precio curso={banner.curso} />
                {banner.mostrar_contador && <CuentaRegresiva hasta={banner.termina_en} desfaseMs={desfase} onTermina={() => quitarVencida(banner.id)} />}
              </div>
            </div>
            <Boton oferta={banner} onClick={() => evento(banner.id, 'click')} />
            <button type="button" onClick={() => cerrar(banner)} aria-label="Cerrar oferta" style={{ position: 'absolute', top: 6, right: 10, background: 'none', border: 'none', color: banner.color_texto, fontSize: '1.1rem', cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}

      {popup && (
        <div role="dialog" aria-modal="true" aria-label={popup.titulo} onClick={() => cerrar(popup)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: popup.color_fondo, color: popup.color_texto, borderRadius: 14, maxWidth: 440, width: '100%', overflow: 'hidden', textAlign: 'center' }}>
            {popup.imagen_url && <img src={imagen(popup.imagen_url)} alt="" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }} />}
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{popup.titulo}</div>
              {popup.mensaje && <p style={{ margin: '8px 0' }}>{popup.mensaje}</p>}
              <div style={{ margin: '8px 0' }}><Precio curso={popup.curso} /></div>
              {popup.mostrar_contador && <div style={{ fontSize: '1.2rem', margin: '8px 0' }}><CuentaRegresiva hasta={popup.termina_en} desfaseMs={desfase} onTermina={() => quitarVencida(popup.id)} /></div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                <Boton oferta={popup} onClick={() => { evento(popup.id, 'click'); cerrar(popup); }} estilo={{ padding: '10px 20px' }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => cerrar(popup)} style={{ borderColor: popup.color_texto, color: popup.color_texto }}>Ahora no</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
