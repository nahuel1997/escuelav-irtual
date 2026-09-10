const agentFlowModel = require('../models/agentFlow.model');
const { CATALOGO, clavesValidas } = require('../services/agentProviders');
const { ejecutarFlujo } = require('../services/agentOrchestrator.service');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

// Valida y normaliza el arreglo de nodos que manda el frontend: cada nodo
// necesita nombre y un proveedor de la lista permitida (si no, cae a
// "privado" — nunca rompe la ejecución por un valor inesperado).
function normalizarNodos(nodos) {
  if (!Array.isArray(nodos)) throw new AppError('El flujo necesita un arreglo de nodos', 400);
  if (nodos.length === 0) throw new AppError('El flujo necesita al menos un agente', 400);
  const proveedoresValidos = clavesValidas();
  return nodos.map((n, i) => ({
    id: n.id || `nodo-${i + 1}`,
    nombre: (n.nombre || `Agente ${i + 1}`).trim(),
    rol: (n.rol || '').trim(),
    instrucciones: (n.instrucciones || '').trim(),
    proveedor: proveedoresValidos.includes(n.proveedor) ? n.proveedor : 'privado',
  }));
}

const listarProveedores = asyncHandler(async (req, res) => {
  res.json({ proveedores: CATALOGO });
});

const listar = asyncHandler(async (req, res) => {
  const flujos = await agentFlowModel.listForUser(req.user.id);
  res.json({ flujos });
});

const crear = asyncHandler(async (req, res) => {
  const { nombre, descripcion, nodos } = req.body;
  if (!nombre || !nombre.trim()) throw new AppError('Falta el nombre del flujo', 400);
  const flujo = await agentFlowModel.create(req.user.id, { nombre: nombre.trim(), descripcion, nodos: normalizarNodos(nodos) });
  res.status(201).json({ flujo });
});

const actualizar = asyncHandler(async (req, res) => {
  const existente = await agentFlowModel.getByIdForUser(req.params.id, req.user.id);
  if (!existente) throw new AppError('Flujo no encontrado', 404);

  const { nombre, descripcion, nodos } = req.body;
  if (!nombre || !nombre.trim()) throw new AppError('Falta el nombre del flujo', 400);
  const flujo = await agentFlowModel.update(req.params.id, req.user.id, { nombre: nombre.trim(), descripcion, nodos: normalizarNodos(nodos) });
  res.json({ flujo });
});

const borrar = asyncHandler(async (req, res) => {
  const existente = await agentFlowModel.getByIdForUser(req.params.id, req.user.id);
  if (!existente) throw new AppError('Flujo no encontrado', 404);
  await agentFlowModel.remove(req.params.id, req.user.id);
  res.json({ ok: true });
});

// Ejecución SIMULADA ad-hoc: no hace falta haber guardado el flujo antes
// (así el alumno puede probar mientras todavía está armando los agentes),
// y tampoco se persiste el resultado — es una corrida de práctica, no un
// historial. Ver agentOrchestrator.service.js.
const ejecutar = asyncHandler(async (req, res) => {
  const nodos = normalizarNodos(req.body.nodos);
  const resultado = await ejecutarFlujo(nodos);
  res.json(resultado);
});

module.exports = { listarProveedores, listar, crear, actualizar, borrar, ejecutar };
