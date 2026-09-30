import { formatFecha } from '../utils/fecha';

// Pantalla de "estamos en mantenimiento" para el rol afectado (el admin lo
// prende desde Configuración → Mantenimiento).
export default function Mantenimiento({ mensaje, hasta, onSalir }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card text-center" style={{ maxWidth: 520 }}>
        <div style={{ fontSize: '3rem', lineHeight: 1 }} aria-hidden>🛠️</div>
        <h1 style={{ marginTop: 12 }}>Estamos en mantenimiento</h1>
        <p className="text-muted" style={{ whiteSpace: 'pre-wrap' }}>{mensaje || 'Estamos haciendo mejoras. Volvé en un rato.'}</p>
        {hasta && <p><strong>Volvemos aproximadamente el {formatFecha(hasta)}.</strong></p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
          {onSalir && <button className="btn btn-outline" onClick={onSalir}>Cerrar sesión</button>}
        </div>
      </div>
    </div>
  );
}
