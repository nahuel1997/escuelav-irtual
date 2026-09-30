// Gráfico de barras chico en SVG (sin librerías): lo usan Tráfico, Estado
// de la app y Campañas. `datos` = [{ etiqueta, valor }].
export default function MiniGrafico({ datos, alto = 140, color = 'var(--color-primary)', formato = (v) => v, titulo }) {
  const max = Math.max(1, ...datos.map((d) => Number(d.valor) || 0));
  const ancho = Math.max(datos.length * 18, 240);
  const barra = ancho / Math.max(datos.length, 1);
  return (
    <figure style={{ margin: 0 }}>
      {titulo && <figcaption className="text-muted" style={{ fontSize: '0.85rem', marginBottom: 6 }}>{titulo}</figcaption>}
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${ancho} ${alto + 18}`} width="100%" height={alto + 18} preserveAspectRatio="none" role="img" aria-label={titulo || 'Gráfico'}>
          {datos.map((d, i) => {
            const h = ((Number(d.valor) || 0) / max) * alto;
            return (
              <g key={`${d.etiqueta}-${i}`}>
                <rect x={i * barra + 2} y={alto - h} width={Math.max(barra - 4, 2)} height={h} rx={2} fill={color} opacity={0.85}>
                  <title>{`${d.etiqueta}: ${formato(d.valor)}`}</title>
                </rect>
                {datos.length <= 31 && (i % Math.ceil(datos.length / 12) === 0) && (
                  <text x={i * barra + barra / 2} y={alto + 13} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">{d.etiqueta}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}
