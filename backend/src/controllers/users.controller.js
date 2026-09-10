const userModel = require('../models/user.model');
const { asyncHandler, AppError } = require('../middlewares/error.middleware');

const getProfile = asyncHandler(async (req, res) => {
  const user = await userModel.findPublicById(req.user.id);
  if (!user) throw new AppError('Usuario no encontrado', 404);
  res.json({ user });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { nombre, apellido, avatar_url } = req.body;
  await userModel.updateProfile(req.user.id, { nombre, apellido, avatar_url });
  const user = await userModel.findPublicById(req.user.id);
  res.json({ user });
});

// Lista de profesores para que un alumno logueado pueda elegir con quién
// pedir un turno de calendario (ver calendar.controller.js). No requiere
// rol admin: cualquier usuario logueado puede ver quiénes dan clases.
const listProfesores = asyncHandler(async (req, res) => {
  const profesores = await userModel.listByRole('profesor');
  res.json({ profesores });
});

module.exports = { getProfile, updateProfile, listProfesores };
