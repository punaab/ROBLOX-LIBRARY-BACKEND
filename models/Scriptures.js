const mongoose = require('mongoose');

const scriptureSchema = new mongoose.Schema({
  book: { type: String, required: true },
  chapter: { type: Number, required: true },
  verse: { type: Number, required: true },
  text: { type: String, required: true }
}, { collection: 'scriptures' });

module.exports = mongoose.model('Scripture', scriptureSchema);