const achievementModel = require('../models/achievement.model');
const { asyncHandler } = require('../middlewares/error.middleware');

const listAll = asyncHandler(async (req, res) => {
  const achievements = await achievementModel.listAll();
  res.json({ achievements });
});

const myAchievements = asyncHandler(async (req, res) => {
  const achievements = await achievementModel.listForUser(req.user.id);
  res.json({ achievements });
});

module.exports = { listAll, myAchievements };
