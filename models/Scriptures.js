const mongoose = require('mongoose');

const scriptureSchema = new mongoose.Schema({
  book: { type: String, required: true },
  chapter: { type: Number, required: true },
  verse: { type: Number, required: true },
  text: { type: String, required: true },
  reference: { type: String } // Optional, for formatted reference (e.g., "1 Nephi 1:1")
}, { collection: 'scriptures' });

module.exports = mongoose.model('Scripture', scriptureSchema);