const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  bookId: String,
  title: String,
  author: String,
  coverId: String,
  playerId: String,
  status: { type: String, default: 'Draft' },
  published: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  voters: { type: [String], default: [] },
  comments: { type: Array, default: [] },
  reports: { type: Array, default: [] },
  createdAt: String,
  updatedAt: String,
  glowingBook: { type: Boolean, default: false },
  customCover: { type: Boolean, default: false },
  pageCount: { type: Number, default: 0 },
});

module.exports = mongoose.model('Book', bookSchema);

