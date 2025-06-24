const express = require('express');
const path = require('path');
const router = express.Router();
const Book = require('../models/Book');

// Serve the homepage
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

// === Book API ===

// Get all books
router.get('/api/books', async (req, res) => {
  const books = await Book.find();
  res.json(books);
});

// Get a specific book
router.get('/api/books/:id', async (req, res) => {
  const book = await Book.findOne({ bookId: req.params.id });
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(book);
});

// Publish a new book
router.post('/api/books', async (req, res) => {
  try {
    const newBook = new Book(req.body);
    await newBook.save();
    res.status(201).json({ message: 'Book saved!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save book' });
  }
});

module.exports = router;
