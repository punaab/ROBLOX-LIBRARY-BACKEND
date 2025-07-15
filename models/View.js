// models/View.js
const mongoose = require('mongoose');
const viewSchema = new mongoose.Schema({
  playerId: String,
  bookId: String,
  date: String // e.g. '2024-07-13'
});
module.exports = mongoose.model('View', viewSchema);