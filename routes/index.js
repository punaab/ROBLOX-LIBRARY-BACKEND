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

// Get a book by bookId (alternative endpoint)
router.get('/books/:bookId', async (req, res) => {
  const book = await Book.findOne({ bookId: req.params.bookId });
  if (!book) return res.status(404).json({ error: 'Book not found' });
  res.json(book);
});

// Publish a new book
router.post('/api/books', async (req, res) => {
  try {
    // Validate required fields
    const { title, content, author, playerId } = req.body;
    
    if (!title || !content || !author || !playerId) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, content, author, and playerId are required' 
      });
    }

    // Generate a unique bookId if not provided
    let bookId = req.body.bookId;
    if (!bookId) {
      bookId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    // Check if bookId already exists
    const existingBook = await Book.findOne({ bookId });
    if (existingBook) {
      return res.status(409).json({ error: 'Book with this ID already exists' });
    }

    // Create book object with proper structure
    const bookData = {
      bookId,
      title,
      author,
      content: Array.isArray(content) ? content : [content],
      playerId,
      coverId: req.body.coverId || '',
      upvotes: 0,
      comments: [],
      reports: [],
      createdAt: new Date().toISOString()
    };

    const newBook = new Book(bookData);
    await newBook.save();
    
    res.status(201).json({ 
      message: 'Book saved!',
      bookId: bookId,
      book: newBook
    });
  } catch (err) {
    console.error('Error saving book:', err);
    res.status(500).json({ error: 'Failed to save book' });
  }
});

// Alternative POST endpoint for book creation
router.post('/books', async (req, res) => {
  try {
    // Validate required fields
    const { title, content, author, playerId } = req.body;
    
    if (!title || !content || !author || !playerId) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, content, author, and playerId are required' 
      });
    }

    // Generate a unique bookId if not provided
    let bookId = req.body.bookId;
    if (!bookId) {
      bookId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    // Check if bookId already exists
    const existingBook = await Book.findOne({ bookId });
    if (existingBook) {
      return res.status(409).json({ error: 'Book with this ID already exists' });
    }

    // Create book object with proper structure
    const bookData = {
      bookId,
      title,
      author,
      content: Array.isArray(content) ? content : [content],
      playerId,
      coverId: req.body.coverId || '',
      upvotes: 0,
      comments: [],
      reports: [],
      createdAt: new Date().toISOString()
    };

    const newBook = new Book(bookData);
    await newBook.save();
    
    res.status(201).json({ 
      message: 'Book saved!',
      bookId: bookId,
      book: newBook
    });
  } catch (err) {
    console.error('Error saving book:', err);
    res.status(500).json({ error: 'Failed to save book' });
  }
});

module.exports = router;
