const mongoose = require('mongoose');
const playerSchema = new mongoose.Schema({
  playerId: String,
  username: String,
  xp: { type: Number, default: 0 },
  playtime: { type: Number, default: 0 }, // see #5
  comments: { type: Number, default: 0 } // see #3
});
module.exports = mongoose.model('Player', playerSchema);
