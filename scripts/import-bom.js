// scripts/import-bom.js
const mongoose = require('mongoose');
const fs = require('fs');
const Scripture = require('../models/Scriptures');

mongoose.connect('your-mongodb-connection-string', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const data = JSON.parse(fs.readFileSync('data/book-of-mormon.json')).books;
    for (const book of data) {
      for (const chapter of book.chapters) {
        await Scripture.create({
          book: book.book,
          chapter: chapter.chapter,
          reference: chapter.reference,
          verses: chapter.verses,
        });
      }
    }
    console.log('Imported Book of Mormon data');
    mongoose.disconnect();
  })
  .catch(err => console.error('Import failed:', err));