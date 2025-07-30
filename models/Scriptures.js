// models/Scripture.js
const mongoose = require('mongoose');
const scriptureSchema = new mongoose.Schema({
  book: String,
  chapter: Number,
  reference: String,
  verses: [{
    verse: Number,
    reference: String,
    text: String,
  }],
});
module.exports = mongoose.model('Scripture', scriptureSchema);