// Tráfico: páginas vistas del sitio (trafico_eventos). Las registra el
// frontend al cambiar de pantalla (POST /api/app/vista). Sin datos
// personales para los visitantes sin sesión: solo un id anónimo que genera
// el navegador.
const db = require('../config/db');
const { paraSql, haceDias, aDate } = require('../utils/sqlFecha');
const { ZONA_HORARIA_DEFAULT } = require('../utils/fecha');

function registrarVista({ userId, rol, visitante, pagina, referencia, dispositivo }) {
  return db('trafico_eventos').insert({
    user_id: userId || null,
    rol: rol || null,
    visitante: visitante || null,
    pagina,
    referencia: referencia || null,
    dispositivo: dispositivo || null,
  });
}

function rango({ desde, hasta }) {
  const q = db('trafico_eventos');
  q.where('ts', '>=', paraSql(desde));
  q.where('ts', '<=', paraSql(hasta));
  return q;
}

// Día y hora en la zona horaria de la escuela (no en UTC): una visita de
// las 23 hs de Argentina cuenta para ese día, no para el siguiente.
const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_DEFAULT, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('en-US', { timeZone: ZONA_HORARIA_DEFAULT, hour: 'numeric', hourCycle: 'h23' });

function diaDe(ts) {
  const d = aDate(ts);
  return Number.isNaN(d.getTime()) ? String(ts).slice(0, 10) : fmtDia.format(d);
}

function horaDe(ts) {
  const h = Number(fmtHora.format(aDate(ts)));
  return Number.isInteger(h) && h >= 0 && h < 24 ? h : 0;
}

// Todo se agrega en JS (y no con funciones de fecha de SQL) para que
// funcione igual en SQLite y en Postgres. Con la poda de 90 días el
// volumen se mantiene manejable.
async function resumen({ desde, hasta }) {
  const filas = await rango({ desde, hasta }).select('ts', 'user_id', 'rol', 'visitante', 'pagina', 'dispositivo').limit(200000);
  const porDia = {};
  const porHora = Array(24).fill(0);
  const porPagina = {};
  const porRol = {};
  const porDispositivo = {};
  const personas = new Set();
  for (const f of filas) {
    const dia = diaDe(f.ts);
    porDia[dia] = porDia[dia] || { vistas: 0, personas: new Set() };
    porDia[dia].vistas += 1;
    const quien = f.user_id ? `u${f.user_id}` : `v${f.visitante || '?'}`;
    porDia[dia].personas.add(quien);
    personas.add(quien);
    porHora[horaDe(f.ts)] += 1;
    porPagina[f.pagina] = (porPagina[f.pagina] || 0) + 1;
    const rol = f.rol || 'visitante';
    porRol[rol] = (porRol[rol] || 0) + 1;
    const disp = f.dispositivo || 'escritorio';
    porDispositivo[disp] = (porDispositivo[disp] || 0) + 1;
  }
  return {
    totalVistas: filas.length,
    personasUnicas: personas.size,
    porDia: Object.entries(porDia).sort(([a], [b]) => a.localeCompare(b)).map(([dia, v]) => ({ dia, vistas: v.vistas, personas: v.personas.size })),
    porHora: porHora.map((vistas, hora) => ({ hora, vistas })),
    paginas: Object.entries(porPagina).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([pagina, vistas]) => ({ pagina, vistas })),
    porRol,
    porDispositivo,
  };
}

function ultimos(n = 100) {
  return db('trafico_eventos as t')
    .leftJoin('users as u', 'u.id', 't.user_id')
    .select('t.id', 't.ts', 't.rol', 't.pagina', 't.dispositivo', 'u.nombre', 'u.apellido')
    .orderBy('t.id', 'desc')
    .limit(n);
}

function limpiarViejos(dias = 90) {
  return db('trafico_eventos').where('ts', '<', haceDias(dias)).del();
}

module.exports = { registrarVista, resumen, ultimos, limpiarViejos };
