const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  bookId: String,
  title: String,
  author: String,
  content: [String],
  coverId: String,
  playerId: String,
  status: { type: String, default: 'Draft' },
  published: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  comments: { type: Array, default: [] },
  reports: { type: Array, default: [] },
  createdAt: String
});

module.exports = mongoose.model('Book', bookSchema);
