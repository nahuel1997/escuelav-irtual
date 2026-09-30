import { useEffect, useState } from 'react';

function partes(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const dos = (n) => String(n).padStart(2, '0');

// Cuenta regresiva hasta `hasta` ("2d 04:13:22"). `desfaseMs` corrige la
// diferencia entre el reloj del servidor y el de la compu del usuario, así
// una compu con la hora mal no muestra un contador equivocado.
export default function CuentaRegresiva({ hasta, desfaseMs = 0, onTermina, compacta = false }) {
  const fin = new Date(hasta).getTime();
  const [falta, setFalta] = useState(() => fin - (Date.now() + desfaseMs));

  useEffect(() => {
    const t = setInterval(() => {
      const f = fin - (Date.now() + desfaseMs);
      setFalta(f);
      if (f <= 0) {
        clearInterval(t);
        if (onTermina) onTermina();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [fin, desfaseMs, onTermina]);

  if (falta <= 0) return <span>¡Terminó!</span>;
  const p = partes(falta);
  const texto = `${p.d ? `${p.d}d ` : ''}${dos(p.h)}:${dos(p.m)}:${dos(p.s)}`;
  return (
    <span role="timer" aria-live="off" aria-label={`Termina en ${p.d} días, ${p.h} horas y ${p.m} minutos`} style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
      {compacta ? texto : `Termina en ${texto}`}
    </span>
  );
}
