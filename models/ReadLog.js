// models/ReadLog.js
const mongoose = require('mongoose');

const readLogSchema = new mongoose.Schema({
  playerId: String,
  bookId: String,
  date: String, // formatted as YYYY-MM-DD
});

module.exports = mongoose.model('ReadLog', readLogSchema);

