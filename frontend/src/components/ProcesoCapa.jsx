// Capa gris sobre una sección mientras corre un proceso en segundo plano
// (mismo comportamiento que data-proceso-seccion de DBA24): tapa solo esa
// sección, muestra el número de seguimiento y el avance. El contenedor
// padre tiene que tener position: relative.
export default function ProcesoCapa({ proceso }) {
  if (!proceso || !['pendiente', 'en_curso'].includes(proceso.estado)) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute', inset: 0, background: 'rgba(245,247,250,0.82)', zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'inherit',
      }}
    >
      <div className="card" style={{ margin: 0, textAlign: 'center', minWidth: 240 }}>
        <div className="spinner-msg" style={{ margin: 0 }}>{proceso.estado === 'pendiente' ? 'En cola…' : 'Procesando…'}</div>
        <div style={{ fontWeight: 700, marginTop: 6 }}>{proceso.numero}</div>
        <div className="text-muted" style={{ fontSize: '0.85rem' }}>{proceso.titulo}</div>
        <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ width: `${proceso.progreso || 5}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.3s' }} />
        </div>
        <p className="text-muted" style={{ fontSize: '0.78rem', margin: '8px 0 0' }}>Podés seguir usando el resto de la app.</p>
      </div>
    </div>
  );
}
