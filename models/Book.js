const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  bookId: { type: String, required: true },
  title: { type: String, required: true },
  author: { type: String, default: 'Anonymous' },
  coverId: { type: String, default: '6047363187' },
  playerId: { type: String, required: true },
  status: { type: String, default: 'Draft' },
  published: { type: Boolean, default: false },
  upvotes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  voters: { type: [String], default: [] },
  comments: { type: Array, default: [] },
  reports: { type: Array, default: [] },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  glowingBook: { type: Boolean, default: false },
  customCover: { type: Boolean, default: false },
  pageCount: { type: Number, default: 0 }, 
  genres: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  publisher: { type: String, default: '' },
  publishedDate: { type: String, default: '' },
  description: { type: String, default: '' },
  language: { type: String, default: '' },
  price: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
});

bookSchema.index({ bookId: 1 }, { unique: true });
bookSchema.index({ playerId: 1, status: 1, published: 1 });

module.exports = mongoose.model('Book', bookSchema);

