const mongoose = require('mongoose');
const reportSchema = new mongoose.Schema(
{
    "reportId": "123",
    "bookId": "abc",
    "bookTitle": "My Book",
    "playerId": "999",
    "playerName": "YeetusYeetus294",
    "reason": "Inappropriate content",
    "date": "2025-07-16T22:15:00Z"
  })
  module.exports = mongoose.model('Reports', reportSchema);