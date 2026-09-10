// Endpoint que consumen los sistemas externos dados de alta en "APIs"
// (ver AdminApis.jsx): lectura de una tabla, recortada a las columnas que
// el admin le permitió a ESE cliente puntual. Nunca escribe nada — es
// solo lectura, a propósito (el admin de la app ya tiene sus propios
// endpoints para modificar datos; esta API es para que otro sistema
// pueda LEER lo que se le habilitó).
const db = require('../config/db');
const apiClientModel = require('../models/apiClient.model');
const apiUsageLogModel = require('../models/apiUsageLog.model');
const dataCatalogService = require('../services/dataCatalog.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const LIMITE_DEFAULT = 50;
const LIMITE_MAXIMO = 200;

const getDatos = asyncHandler(async (req, res) => {
  const inicio = Date.now();
  const { tabla } = req.params;
  const clientId = req.apiClient.id;

  const columnasPermitidas = await apiClientModel.permisoPara(clientId, tabla);
  if (!columnasPermitidas || columnasPermitidas.length === 0) {
    throw new AppError('No tenés acceso a esta tabla', 403);
  }

  // Intersección defensiva contra las columnas reales de HOY: si la
  // tabla cambió después de otorgar el permiso (una columna se borró en
  // una migración nueva), no queremos que knex tire un error de SQL — se
  // sirve con lo que sigue existiendo.
  const columnasReales = await dataCatalogService.listarColumnas(tabla);
  const columnas = columnasPermitidas.filter((c) => columnasReales.includes(c));
  if (columnas.length === 0) {
    throw new AppError('Ninguna de las columnas habilitadas existe ya en esta tabla — pedile al admin que revise el acceso', 409);
  }

  const limit = Math.min(Number(req.query.limit) || LIMITE_DEFAULT, LIMITE_MAXIMO);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const [filas, { count }] = await Promise.all([
    db(tabla).select(columnas).limit(limit).offset(offset),
    db(tabla).count({ count: '*' }).first(),
  ]);

  res.json({ tabla, columnas, total: Number(count), limit, offset, filas });

  // El log se escribe DESPUÉS de responder (no le agrega latencia al
  // cliente) y es best-effort: si falla, no tiene que afectar la
  // respuesta que ya se mandó.
  apiUsageLogModel
    .create(clientId, { tabla, ip: req.ip, duracionMs: Date.now() - inicio, filasDevueltas: filas.length })
    .catch((e) => console.error('[api_usage_log]', e.message));
});

module.exports = { getDatos };
