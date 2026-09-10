import { Link } from 'react-router-dom';
import Icon from './Icon';

// Línea de tiempo horizontal de los capítulos de una unidad: un punto por
// capítulo (completado / disponible / bloqueado), con el % general al
// costado. Se reutiliza en la página de la unidad (CourseUnitDetail) y en
// la del capítulo (CourseChapter, ahí más compacta) para que el alumno
// siempre vea de un vistazo cuánto le falta y qué puede abrir.
export default function ChapterTimeline({ capitulos, currentChapterId, basePath, porcentaje }) {
  return (
    <div>
      {porcentaje !== undefined && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: 4 }}>
            <span className="text-muted">Progreso</span>
            <strong>{porcentaje}%</strong>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: 'var(--color-bg-alt)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${porcentaje}%`, background: 'var(--color-accent)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {capitulos.map((cap, i) => {
          const esActual = cap.id === currentChapterId;
          const contenido = (
            <div
              title={cap.titulo}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                border: esActual ? '2px solid var(--color-primary)' : '2px solid transparent',
                background: cap.completado ? 'var(--color-accent)' : cap.desbloqueado ? 'var(--color-bg-alt)' : 'var(--color-bg-alt)',
                color: cap.completado ? '#000' : cap.desbloqueado ? 'var(--color-text)' : 'var(--color-text-muted)',
                opacity: cap.desbloqueado ? 1 : 0.55,
                cursor: cap.desbloqueado ? 'pointer' : 'not-allowed',
              }}
            >
              {cap.completado ? <Icon name="check" size={14} strokeWidth={2.5} /> : cap.desbloqueado ? i + 1 : <Icon name="lock" size={13} />}
            </div>
          );
          return (
            <div key={cap.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {cap.desbloqueado ? (
                <Link to={`${basePath}${cap.id}`} style={{ display: 'flex' }}>{contenido}</Link>
              ) : (
                contenido
              )}
              {i < capitulos.length - 1 && <div style={{ width: 16, height: 2, background: 'var(--color-border)' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
