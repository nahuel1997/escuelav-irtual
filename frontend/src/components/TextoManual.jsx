// Texto del manual: párrafos separados por salto de línea (sin HTML: lo
// escribe el admin y se muestra como texto plano, nunca como HTML).
export default function TextoManual({ texto }) {
  return String(texto || '').split('\n').filter((l) => l.trim()).map((l, i) => <p key={i} style={{ margin: '0 0 8px' }}>{l}</p>);
}
