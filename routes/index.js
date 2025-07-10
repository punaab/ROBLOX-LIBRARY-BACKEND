const express = require('express');
const path = require('path');
const router = express.Router();
const Book = require('../models/Book');
const axios = require('axios');

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
// Get drafts for a player (DRAFTS ONLY)
router.get('/api/books/drafts', async (req, res) => {
  try {
    const playerId = req.query.playerId;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }
    // Only return books with BOTH status: 'Draft' AND published: false
    const drafts = await Book.find({ playerId, status: 'Draft', published: false });
    res.json(drafts);
  } catch (err) {
    console.error('Error fetching drafts:', err);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
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
    const { bookId, title, content, playerId, coverId, createdAt } = req.body;
    
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
      createdAt: createdAt || new Date().toISOString()
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
    const { title, content, playerId, coverId, createdAt } = req.body;

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
      createdAt: createdAt || new Date().toISOString()
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
    if (update.createdAt) {
      update.createdAt = update.createdAt || new Date().toISOString();
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

// Delete a book by bookId (not Mongo _id)
router.delete('/api/books/:bookId', async (req, res) => {
  try {
    const bookId = req.params.bookId;
    console.log('[DELETE] bookId param:', bookId);

    // Extra debug: log all IDs in DB
    const allBooks = await Book.find({ status: 'Draft' });
    console.log('Drafts in DB:', allBooks.map(b => b.bookId));

    const deleted = await Book.findOneAndDelete({ bookId: bookId });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    res.json({ success: true, message: 'Book deleted', book: deleted });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Remove redundant endpoints
router.post('/books', async (req, res) => {
  return res.redirect(308, '/api/books');
});
router.put('/books/:bookId', async (req, res) => {
  return res.redirect(308, `/api/books/${req.params.bookId}`);
});
router.patch('/books/:bookId', async (req, res) => {
  return res.redirect(308, `/api/books/${req.params.bookId}`);
});

// === Roblox API Proxy ===

// Fetch user's public Decal assets
router.get('/api/user-decals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    // Get first 30 decals (you can add paging if needed)
    const url = `https://catalog.roblox.com/v1/search/items?category=Decal&creatorTargetId=${userId}&limit=30&sortOrder=Desc`;
    const robloxRes = await axios.get(url);
    // Extract needed data
    const results = (robloxRes.data.data || []).map(asset => ({
      name: asset.name,
      id: asset.id,
      thumbnail: asset.thumbnailImageUrl || `https://www.roblox.com/asset-thumbnail/image?assetId=${asset.id}&width=150&height=150&format=png`
    }));
    res.json({ success: true, decals: results });
  } catch (err) {
    console.error('Failed to fetch user decals:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user decals' });
  }
});

module.exports = router;