const db = require('../config/db');

function listAll() {
  return db('achievements').select('*');
}

function listForUser(userId) {
  return db('user_achievements')
    .join('achievements', 'achievements.id', 'user_achievements.achievement_id')
    .where('user_achievements.user_id', userId)
    .select('achievements.*', 'user_achievements.achieved_at')
    .orderBy('user_achievements.achieved_at', 'desc');
}

// Otorga un logro por su código único, solo si el usuario todavía no lo
// tiene (evita duplicados gracias al unique de la tabla, pero chequeamos
// antes para no depender de capturar el error de constraint).
async function grantIfNotExists(userId, codigo) {
  const achievement = await db('achievements').where({ codigo }).first();
  if (!achievement) return null;

  const yaLoTiene = await db('user_achievements')
    .where({ user_id: userId, achievement_id: achievement.id })
    .first();
  if (yaLoTiene) return null;

  await db('user_achievements').insert({ user_id: userId, achievement_id: achievement.id });
  return achievement;
}

module.exports = { listAll, listForUser, grantIfNotExists };
