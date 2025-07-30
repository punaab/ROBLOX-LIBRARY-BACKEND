const mongoose = require('mongoose');

const xpSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  username: { type: String, required: true },
  xp: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

xpSchema.index({ playerId: 1 }, { unique: true });
xpSchema.index({ xp: -1 }); // For leaderboard queries

module.exports = mongoose.model('XP', xpSchema);