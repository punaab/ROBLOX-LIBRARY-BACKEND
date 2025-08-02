const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  bookId: { type: String, required: true },
  page: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'bookmarks' });

module.exports = mongoose.model('Bookmark', bookmarkSchema);