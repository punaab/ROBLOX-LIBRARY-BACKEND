const mongoose = require('mongoose');
const commentsSchema = new mongoose.Schema({
    playerId: String,
    username: String,
    text: String,
    createdAt: String,
    likes: [String],     // Array of playerIds
    dislikes: [String]   // Array of playerIds
  });
  module.exports = mongoose.model('Comments', commentsSchema);

  