const mongoose = require('mongoose');
const fs = require('fs');

// Connect to MongoDB (replace with your URI)
mongoose.connect('mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true });

const Scripture = require('../models/Scripture');

// Read JSON file
const data = JSON.parse(fs.readFileSync('data/book-of-mormon.json', 'utf8'));

// Transform and insert data
async function importData() {
  try {
    const scriptures = [];
    data.books.forEach(book => {
      book.chapters.forEach(chapter => {
        chapter.verses.forEach(verse => {
          scriptures.push({
            book: book.book,
            chapter: chapter.chapter,
            verse: verse.verse,
            text: verse.text,
            reference: verse.reference
          });
        });
      });
    });
    await Scripture.insertMany(scriptures);
    console.log('Imported', scriptures.length, 'scriptures');
    mongoose.connection.close();
  } catch (err) {
    console.error('Import error:', err);
    mongoose.connection.close();
  }
}

importData();