// Quién está conectado ahora (Tráfico → "En línea" y Estado de la app).
// En memoria: cada request autenticado marca la última actividad del
// usuario (lo hace requireAuth). "En línea" = actividad en los últimos 5
// minutos. Se pierde al reiniciar el proceso, lo cual está bien: es una
// foto del momento, no un historial (el historial es trafico_eventos).
const VENTANA_MS = 5 * 60 * 1000;
const presentes = new Map(); // userId -> { id, nombre, rol, ultima, ruta }

function marcar(user, ruta) {
  if (!user || !user.id) return;
  presentes.set(user.id, { id: user.id, nombre: user.nombre || user.email, rol: user.rol, ultima: Date.now(), ruta: ruta || null });
}

function online() {
  const limite = Date.now() - VENTANA_MS;
  const lista = [];
  for (const [id, p] of presentes) {
    if (p.ultima < limite) presentes.delete(id);
    else lista.push({ ...p, ultima: new Date(p.ultima).toISOString() });
  }
  return lista.sort((a, b) => b.ultima.localeCompare(a.ultima));
}

module.exports = { marcar, online, VENTANA_MS };
