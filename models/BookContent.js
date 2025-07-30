// models/BookContent.js
const mongoose = require('mongoose');
const bookContentSchema = new mongoose.Schema({
  bookId: { type: String, required: true },
  pageNumber: { type: Number, required: true },
  text: { type: String, required: true },
});
bookContentSchema.index({ bookId: 1, pageNumber: 1 }, { unique: true }); // Ensure unique pages per book
module.exports = mongoose.model('BookContent', bookContentSchema);