// =============================================================================
// testing.controller.js — Corre la suite de Jest/Supertest (backend/tests/)
// a pedido, desde un botón del panel de admin, y devuelve el resultado
// parseado (cuántos tests pasaron/fallaron, y el detalle de los que
// fallaron) para mostrarlo en la UI sin tener que abrir una terminal.
//
// Por qué es seguro correr esto disparado desde un click:
// - Solo admin puede llegar acá (router.use(requireAuth, requireRole('admin'))
//   en admin.routes.js cubre todo /api/admin/*, incluida esta ruta).
// - Cada archivo de test usa su propia base SQLite separada
//   (test-auth.sqlite3, test-admin.sqlite3, etc. — ver el DB_CLIENT/
//   SQLITE_FILE que pisa cada uno al arrancar) y nodemon.json ignora
//   "data/*" y "**/*.test.js", así que correr esto no toca la base de
//   desarrollo ni reinicia el server. Tampoco dispara los cron jobs de
//   mails (ver app.js: solo arrancan si require.main === module).
// - `suite.archivo` SIEMPRE sale del array SUITES de acá abajo, nunca de
//   algo que mande el cliente — el id que llega por la URL solo se usa
//   para buscar en ese array (whitelist), nunca se concatena directo a un
//   comando. Por eso, aunque el comando se ejecuta con shell:true (hace
//   falta en Windows para resolver npx.cmd), no hay manera de inyectar
//   nada: ningún dato del request llega al string del comando.
const { execFile } = require('child_process');
const path = require('path');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');
const checkoutService = require('../services/checkout.service');
const paymentsService = require('../services/payments.service');
const paymentOrderModel = require('../models/paymentOrder.model');

const BACKEND_ROOT = path.join(__dirname, '..', '..');

// Un suite por archivo de test existente + un nombre legible para la UI.
// Agregar un archivo de test nuevo en backend/tests/ es sumar una línea acá.
const SUITES = [
  { id: 'auth', label: 'Autenticación (registro, login, sesión, validación por código)', archivo: 'auth.test.js' },
  { id: 'rateLimit', label: 'Rate limiting de login', archivo: 'rateLimit.test.js' },
  { id: 'courses', label: 'Cursos y compra (inscripción, logro automático)', archivo: 'courses.test.js' },
  { id: 'cart', label: 'Carrito de compras (agregar, quitar, checkout)', archivo: 'cart.test.js' },
  { id: 'calendar', label: 'Calendario de turnos (solicitar/aceptar/rechazar, solapamiento)', archivo: 'calendar.test.js' },
  { id: 'liveClasses', label: 'Clases en vivo (agendar, permisos, sala, iniciar/finalizar, chat en vivo)', archivo: 'liveClasses.test.js' },
  { id: 'mails', label: 'Backoffice de mails (plantillas, configuración, listas)', archivo: 'mails.test.js' },
  { id: 'chat', label: 'Chat de soporte (historial, registro, socket en vivo)', archivo: 'chat.test.js' },
  { id: 'admin', label: 'Panel de administración (permisos, altas, dashboard)', archivo: 'admin.test.js' },
  { id: 'backoffice', label: 'Backoffice (contenido, botones, errores, logins)', archivo: 'backoffice.test.js' },
  { id: 'testingRoutes', label: 'Rutas de este mismo panel de Testing', archivo: 'testingRoutes.test.js' },
  { id: 'curriculumService', label: 'Temario — lógica de desbloqueo (los 3 modos de avance, regla del 80%)', archivo: 'curriculum.service.test.js' },
  { id: 'curriculum', label: 'Temario — endpoints (unidades, capítulos, progreso, comentarios, archivos)', archivo: 'curriculum.test.js' },
];

const listSuites = asyncHandler(async (req, res) => {
  res.json({ suites: SUITES.map(({ id, label, archivo }) => ({ id, label, archivo })) });
});

// Corre `jest <archivo> --json` como proceso hijo y devuelve un resumen.
// jest no siempre exit-code 0 cuando hay tests fallidos (así se espera),
// así que leemos el resultado del stdout en vez de confiar en el código
// de salida.
function correrJest(archivo) {
  return new Promise((resolve) => {
    execFile(
      'npx',
      ['jest', archivo, '--json', '--runInBand'],
      { cwd: BACKEND_ROOT, shell: true, timeout: 120000, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        // jest imprime cosas por stderr (progreso) aunque todo salga bien;
        // lo único que importa es si stdout tiene el JSON esperado.
        const inicio = stdout.indexOf('{');
        if (inicio === -1) {
          resolve({
            ok: false,
            errorEjecucion: 'No se pudo correr Jest. ¿Está instalado (¿corriste "npm install"?)',
            detalle: (stderr || error?.message || '').slice(0, 2000),
          });
          return;
        }
        try {
          const json = JSON.parse(stdout.slice(inicio));
          const tests = (json.testResults || []).flatMap((tr) => tr.assertionResults || []);
          resolve({
            ok: json.success,
            numTotalTests: json.numTotalTests,
            numPassedTests: json.numPassedTests,
            numFailedTests: json.numFailedTests,
            tests: tests.map((t) => ({
              titulo: t.fullName || t.title,
              estado: t.status,
              error: t.status === 'failed' ? (t.failureMessages || []).join('\n').split('\n').slice(0, 6).join('\n') : undefined,
            })),
          });
        } catch (e) {
          resolve({
            ok: false,
            errorEjecucion: 'Jest corrió pero no se pudo interpretar la salida.',
            detalle: (stdout || '').slice(0, 2000),
          });
        }
      }
    );
  });
}

const runSuite = asyncHandler(async (req, res) => {
  const suite = SUITES.find((s) => s.id === req.params.id);
  if (!suite) throw new AppError('Suite de test desconocida', 404);
  const resultado = await correrJest(suite.archivo);
  res.json({ suite: suite.id, ...resultado });
});

// =============================================================================
// "Test Pagos" (/admin-panel/testing/pagos) — probar Mercado Pago/PayPal de
// punta a punta como si fuera una compra manual, con un precio que pone el
// admin (no sale de ningún curso real). Corre con las MISMAS credenciales
// reales que configuró el proyecto (MP_ACCESS_TOKEN/PAYPAL_CLIENT_ID en
// .env) — por convención de este proyecto esas son credenciales de PRUEBA/
// sandbox de cada pasarela (ver README, sección "Pagos reales"), así que
// esto no cobra plata real. La orden queda marcada `es_prueba` (ver la
// migración 20260828000004) para que, aunque el pago se confirme de
// verdad contra el proveedor, NO inscriba a nadie en ningún curso ni
// dispare el mail de confirmación de compra — ver el corte temprano en
// checkout.service.js::finalizarOrden.
//
// No hace falta un endpoint de admin aparte para "ver el estado de la
// orden": el admin es el propio comprador de sus órdenes de prueba
// (userId = req.user.id), así que el frontend consulta
// GET /api/payments/ordenes/:id de siempre (requireAuth alcanza, ya
// compara orden.user_id contra el usuario logueado).
const metodosPagoDisponibles = asyncHandler(async (req, res) => {
  res.json({ metodos: paymentsService.metodosDisponibles() });
});

const iniciarPagoDePrueba = asyncHandler(async (req, res) => {
  const { titulo, precio, metodo_pago } = req.body;
  const precioNumero = Number(precio);
  if (!titulo || !String(titulo).trim()) throw new AppError('Falta el título del pago de prueba', 400);
  if (!precio || Number.isNaN(precioNumero) || precioNumero <= 0) throw new AppError('El precio tiene que ser un número mayor a 0', 400);

  const { ordenId, redirectUrl } = await checkoutService.iniciarOrdenDePrueba({
    userId: req.user.id,
    titulo: String(titulo).trim(),
    precio: precioNumero,
    metodoPago: metodo_pago,
    payerEmail: req.user.email,
  });
  res.status(201).json({ ordenId, redirectUrl });
});

const listPagosDePrueba = asyncHandler(async (req, res) => {
  const ordenes = await paymentOrderModel.listPruebasForUser(req.user.id);
  res.json({ ordenes });
});

module.exports = {
  listSuites,
  runSuite,
  metodosPagoDisponibles,
  iniciarPagoDePrueba,
  listPagosDePrueba,
};
