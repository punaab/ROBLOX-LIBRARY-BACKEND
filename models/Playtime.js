const mongoose = require('mongoose');
const playtimeSchema = new mongoose.Schema({
  playerId: String,
  username: String,
  thumbnail: String,
  minutes: Number,
});
module.exports = mongoose.model('Playtime', playtimeSchema);
