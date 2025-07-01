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

// Get drafts for a player
router.get('/api/books/drafts', async (req, res) => {
  try {
    const playerId = req.query.playerId;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }
    const drafts = await Book.find({ playerId, status: 'Draft' });
    res.json(drafts);
  } catch (err) {
    console.error('Error fetching drafts:', err);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
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

// Create a new book
router.post('/api/books', async (req, res) => {
  try {
    const { bookId, title, content, playerId, coverId, createdDate } = req.body;
    
    if (!bookId || !title || !content || !playerId) {
      return res.status(400).json({ 
        error: 'Missing required fields: bookId, title, content, and playerId are required' 
      });
    }

    // Use a default author if not provided
    const author = req.body.author || 'Anonymous';

    // Check if bookId already exists
    const existingBook = await Book.findOne({ bookId });
    if (existingBook) {
      return res.status(409).json({ error: 'Book with this ID already exists' });
    }

    const bookData = {
      bookId,
      title,
      author,
      content: Array.isArray(content) ? content : [content],
      playerId,
      coverId: coverId || '',
      status: req.body.status || 'Draft',
      published: req.body.published || false,
      upvotes: 0,
      comments: [],
      reports: [],
      createdAt: createdDate || new Date().toISOString()
    };

    const newBook = new Book(bookData);
    await newBook.save();
    
    res.status(201).json({ 
      message: 'Book saved!',
      bookId,
      book: newBook
    });
  } catch (err) {
    console.error('Error saving book:', err);
    res.status(500).json({ error: 'Failed to save book' });
  }
});

// Update an existing book
router.put('/api/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { title, content, playerId, coverId, createdDate } = req.body;

    if (!title || !content || !playerId) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, content, and playerId are required' 
      });
    }

    const update = {
      title,
      author: req.body.author || 'Anonymous',
      content: Array.isArray(content) ? content : [content],
      playerId,
      coverId: coverId || '',
      status: req.body.status || 'Draft',
      published: req.body.published || false,
      createdAt: createdDate || new Date().toISOString()
    };

    const updated = await Book.findOneAndUpdate(
      { bookId }, 
      update, 
      { new: true, upsert: false }
    );

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'Book not found' 
      });
    }

    res.json({ 
      success: true, 
      book: updated 
    });
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Partial update an existing book
router.patch('/api/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const update = req.body;

    if (update.content && !Array.isArray(update.content)) {
      update.content = [update.content];
    }
    if (!update.author) {
      update.author = 'Anonymous';
    }

    const updated = await Book.findOneAndUpdate(
      { bookId }, 
      update, 
      { new: true, upsert: false }
    );

    if (!updated) {
      return res.status(404).json({ 
        success: false, 
        message: 'Book not found' 
      });
    }

    res.json({ 
      success: true, 
      book: updated 
    });
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// Remove redundant endpoints
// Note: /books/* endpoints are not used by the client, so consider removing them unless needed
router.post('/books', async (req, res) => {
  return res.redirect(308, '/api/books'); // Redirect to /api/books
});
router.put('/books/:bookId', async (req, res) => {
  return res.redirect(308, `/api/books/${req.params.bookId}`);
});
router.patch('/books/:bookId', async (req, res) => {
  return res.redirect(308, `/api/books/${req.params.bookId}`);
});

module.exports = router;