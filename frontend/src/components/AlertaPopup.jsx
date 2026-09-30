import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

// Pop-up de "Alertas" (ver README): un mensaje de texto libre que mandó
// el admin, que se muestra UNA SOLA VEZ al entrar — se monta una sola vez
// en Layout.jsx (mismo criterio que ChatWidget/CartDrawer) y consulta
// GET /api/alertas/pendiente apenas hay sesión de alumno/profesor. Ese
// mismo GET ya marca la alerta como mostrada del lado del servidor, así
// que no vuelve a aparecer en la próxima carga de página aunque el
// usuario cierre el pop-up sin leerla entera — para volver a leerla
// después está su pestaña "Alertas" (Alertas.jsx), que si lo desea.
export default function AlertaPopup() {
  const { user } = useAuth();
  const [alerta, setAlerta] = useState(null);

  // Mismo motivo que en ChatWidget.jsx: el hook corre siempre (orden de
  // hooks estable), el chequeo de rol decide adentro si hace falta pedir
  // algo — así un visitante anónimo o un admin nunca disparan este GET.
  const puedeTenerAlertas = user && ['alumno', 'profesor'].includes(user.rol);

  useEffect(() => {
    if (!puedeTenerAlertas) return;
    api.get('/alertas/pendiente', { tokenKey: 'token' })
      .then((d) => setAlerta(d.alerta))
      .catch(() => {});
  }, [puedeTenerAlertas]);

  if (!alerta) return null;

  return (
    <>
      <div
        onClick={() => setAlerta(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 120 }}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alerta-popup-titulo"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(420px, calc(100vw - 32px))', background: '#fff', borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)', zIndex: 121, padding: 24,
        }}
      >
        <strong id="alerta-popup-titulo" style={{ fontSize: '1.05rem', display: 'block', marginBottom: 10 }}>
          Aviso
        </strong>
        <p style={{ margin: '0 0 18px', whiteSpace: 'pre-wrap' }}>{alerta.mensaje}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <Link to="/alertas" style={{ fontSize: '0.85rem' }} onClick={() => setAlerta(null)}>Ver todos mis avisos</Link>
          <button className="btn btn-primary btn-sm" onClick={() => setAlerta(null)}>Entendido</button>
        </div>
      </div>
    </>
  );
}
