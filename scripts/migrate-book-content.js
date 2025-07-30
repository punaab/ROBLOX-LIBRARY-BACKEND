// scripts/migrate-book-content.js
const mongoose = require('mongoose');
const Book = require('../models/Book');
const BookContent = require('../models/BookContent');

mongoose.connect('your-mongodb-connection-string', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const books = await Book.find({}).lean();
    for (const book of books) {
      if (book.content && Array.isArray(book.content)) {
        // Insert content into BookContent
        for (let i = 0; i < book.content.length; i++) {
          await BookContent.create({
            bookId: book.bookId,
            pageNumber: i + 1,
            text: book.content[i],
          });
        }
        // Update Book document
        await Book.updateOne(
          { bookId: book.bookId },
          { $set: { pageCount: book.content.length }, $unset: { content: 1 } }
        );
        console.log(`Migrated content for book: ${book.bookId}`);
      }
    }
    console.log('Migration complete');
    mongoose.disconnect();
  })
  .catch(err => console.error('Migration failed:', err));