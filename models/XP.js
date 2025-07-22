const mongoose = require('mongoose');
const xpSchema = new mongoose.Schema({
  playerId: String,
  xp: { type: Number, default: 0 },
  username: String,
});
module.exports = mongoose.model('XP', xpSchema);
