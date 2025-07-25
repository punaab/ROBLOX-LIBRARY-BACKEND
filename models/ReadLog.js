const mongoose = require('mongoose');

const readLogSchema = new mongoose.Schema({
  playerId: String,
  bookId: String,
  date: String, // YYYY-MM-DD
}, { timestamps: true });

module.exports = mongoose.model('ReadLog', readLogSchema);
