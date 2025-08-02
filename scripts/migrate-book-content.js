require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

// Use the same MongoDB connection string as the main server
// For local development, use localhost if Railway URL is not accessible
const MONGODB_URI = process.env.MONGO_URL || 'mongodb://localhost:27017/roblox-library';

console.log('Connecting to MongoDB...');
console.log('Using connection string:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

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