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
  const books = await Book.find().lean();
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
    const drafts = await Book.find({ playerId, status: 'Draft', published: false }).lean();
    res.json(drafts);
  } catch (err) {
    console.error('Error fetching drafts:', err);
    res.status(500).json({ error: 'Failed to fetch drafts' });
  }
});

// Get published books for a player
router.get('/api/books/published', async (req, res) => {
  try {
    const playerId = req.query.playerId;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }
    // Only return books with BOTH status: 'Published' AND published: true
    const publishedBooks = await Book.find({ playerId, status: 'Published', published: true }).lean();
    res.json(publishedBooks);
  } catch (err) {
    console.error('Error fetching published books:', err);
    res.status(500).json({ error: 'Failed to fetch published books' });
  }
});

// Get a book by bookId
// Get a book by bookId and increment views
router.get('/api/books/:bookId', async (req, res) => {
  try {
    // Find and increment views atomically, then return updated book (lean() not needed here)
    const book = await Book.findOneAndUpdate(
      { bookId: req.params.bookId },
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!book) return res.status(404).json({ error: 'Book not found' });
    res.json(book);
  } catch (err) {
    console.error('Error fetching/incrementing views:', err);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});
// Create a new book
// Upsert (insert or update) a book by bookId
router.post('/api/books', async (req, res) => {
  try {
    const { bookId, title, content, playerId, coverId, createdAt } = req.body;

    if (!bookId || !title || !content || !playerId) {
      return res.status(400).json({
        error: 'Missing required fields: bookId, title, content, and playerId are required'
      });
    }

    const author = req.body.author || 'Anonymous';

    // Build update doc (don't overwrite arrays unless provided)
    const updateDoc = {
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
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // ⭐️ Merge existing upvotes/comments/reports (if any) for safety
    const existing = await Book.findOne({ bookId });
    if (existing) {
      updateDoc.upvotes = existing.upvotes;
      updateDoc.comments = existing.comments;
      updateDoc.reports = existing.reports;
    }    

    const options = { upsert: true, new: true, setDefaultsOnInsert: true };

    // Upsert (insert new or update existing by bookId)
    const book = await Book.findOneAndUpdate(
      { bookId },
      updateDoc,
      options
    );

    res.status(200).json({
      message: 'Book upserted!',
      bookId: book.bookId,
      book
    });
  } catch (err) {
    console.error('Error upserting book:', err);
    res.status(500).json({ error: 'Failed to upsert book' });
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
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
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
    
    // Always set updatedAt for any update
    update.updatedAt = new Date().toISOString();

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
    const allBooks = await Book.find({ status: 'Draft' }).lean();
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

// Publish a draft book
router.post('/api/books/:bookId/publish', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({ 
        error: 'playerId is required' 
      });
    }

    // Find the draft book
    const draftBook = await Book.findOne({ 
      bookId, 
      playerId, 
      status: 'Draft', 
      published: false 
    });

    if (!draftBook) {
      return res.status(404).json({ 
        success: false, 
        message: 'Draft book not found or already published' 
      });
    }

    // Update the book to published status
    const publishedBook = await Book.findOneAndUpdate(
      { bookId },
      { 
        status: 'Published',
        published: true,
        updatedAt: new Date().toISOString()
      },
      { new: true }
    );

    console.log(`[PUBLISH] Book ${bookId} published successfully for player ${playerId}`);

    res.json({ 
      success: true, 
      message: 'Book published successfully!',
      book: publishedBook
    });
  } catch (err) {
    console.error('Error publishing book:', err);
    res.status(500).json({ error: 'Failed to publish book' });
  }
});

// Legacy redirects for backward compatibility (optional - can be removed)
router.get('/books/:bookId', async (req, res) => {
  return res.redirect(308, `/api/books/${req.params.bookId}`);
});
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

// GET /api/votes?playerId=123&bookId=abc
router.get('/api/votes', async (req, res) => {
  const { playerId, bookId } = req.query;
  if (!playerId || !bookId) return res.status(400).json({ error: "Missing playerId or bookId" });
  const book = await Book.findOne({ bookId });
  if (!book) return res.json({ voted: false });
  const hasVoted = (book.voters || []).includes(playerId);
  res.json({ voted: hasVoted });
});

// POST /api/votes
router.post('/api/votes', async (req, res) => {
  const { playerId, bookId, voteType } = req.body;
  if (voteType !== "up") return res.status(400).json({ error: "Only 'up' supported" });
  if (!playerId || !bookId) return res.status(400).json({ error: "Missing playerId or bookId" });
  const book = await Book.findOne({ bookId });
  if (!book) return res.status(404).json({ error: "Book not found" });
  if (!book.voters) book.voters = [];
  if (!book.voters.includes(playerId)) {
    book.voters.push(playerId);
    book.upvotes = (book.upvotes || 0) + 1;
    await book.save();
  }
  res.json({ success: true, upvotes: book.upvotes });
});

module.exports = router;