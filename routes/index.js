const express = require('express');
const path = require('path');
const router = express.Router();
const Book = require('../models/Book');
const BookContent = require('../models/BookContent'); // Add this
const View = require('../models/View');
const Playtime = require('../models/Playtime');
const XP = require('../models/XP');
const ReadLog = require('../models/ReadLog');
const axios = require('axios');
const searchRoutes = require('./search');
const bomRoute = require('./bookofmormon');
const NodeCache = require('node-cache');
const bookCache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL

let mostBooksReadCache = [];
let lastUpdate = 0;

// Cache for most books read
async function updateMostBooksReadCache() {
  const now = Date.now();
  if (now - lastUpdate < 30 * 1000) return; // 30s cache
  const data = await ReadLog.aggregate([
    {
      $group: {
        _id: "$playerId",
        uniqueBooks: { $addToSet: "$bookId" }
      }
    },
    {
      $project: {
        playerId: "$_id",
        count: { $size: "$uniqueBooks" }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  for (const entry of data) {
    const xpEntry = await XP.findOne({ playerId: entry.playerId });
    entry.username = xpEntry?.username || "Unknown";
  }
  mostBooksReadCache = data;
  lastUpdate = now;
}

// Search
router.use('/api/search', searchRoutes);

// GET /leaderboard/most-books-read
router.get('/leaderboard/most-books-read', async (req, res) => {
  try {
    await updateMostBooksReadCache();
    res.json(mostBooksReadCache);
  } catch (err) {
    console.error("❌ Failed to fetch leaderboard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Serve the homepage
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/index.html'));
});

// Get all books
router.get('/api/books', async (req, res) => {
  try {
    const cacheKey = `books:${req.query.page || 1}:${req.query.limit || 10}`;
    const cached = bookCache.get(cacheKey);
    if (cached) {
      console.log(`[CACHE] Serving cached books for ${cacheKey}`);
      return res.json(cached);
    }
    const { page = 1, limit = 10 } = req.query;
    const books = await Book.find({ published: true })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    const total = await Book.countDocuments({ published: true });
    const response = { books, total, page: Number(page), limit: Number(limit) };
    bookCache.set(cacheKey, response);
    console.log(`[CACHE] Stored books for ${cacheKey}`);
    res.json(response);
  } catch (err) {
    console.error('Error fetching books:', err);
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// Get drafts for a player
router.get('/api/books/drafts', async (req, res) => {
  try {
    const playerId = req.query.playerId;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }
    const drafts = await Book.find({ playerId, status: 'Draft', published: false }).lean();
    for (const draft of drafts) {
      const content = await BookContent.find({ bookId: draft.bookId }).sort({ pageNumber: 1 }).lean();
      draft.content = content.map(c => c.text);
    }
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
    const publishedBooks = await Book.find({ playerId, status: 'Published', published: true }).lean();
    for (const book of publishedBooks) {
      const content = await BookContent.find({ bookId: book.bookId }).sort({ pageNumber: 1 }).lean();
      book.content = content.map(c => c.text);
    }
    res.json(publishedBooks);
  } catch (err) {
    console.error('Error fetching published books:', err);
    res.status(500).json({ error: 'Failed to fetch published books' });
  }
});

// Get a book by bookId
router.get('/api/books/:bookId', async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId }).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });
    const content = await BookContent.find({ bookId: req.params.bookId }).sort({ pageNumber: 1 }).lean();
    book.content = content.map(c => c.text);
    res.json(book);
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// Create or update a book
router.post('/api/books', async (req, res) => {
  try {
    const { bookId, title, content, playerId, coverId, createdAt } = req.body;
    if (!bookId || !title || !content || !playerId) {
      return res.status(400).json({ error: 'Missing required fields: bookId, title, content, playerId' });
    }
    // Validate content
    if (!Array.isArray(content) || content.some(page => typeof page !== 'string' || page.length > 1000)) {
      return res.status(400).json({ error: 'Invalid content: must be array of strings, max 1000 chars per page' });
    }
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title too long (max 100 chars)' });
    }
    // Content moderation
    const badWords = ['inappropriate', 'offensive']; // Expand this list
    if (content.some(page => badWords.some(word => page.toLowerCase().includes(word))) || title.toLowerCase().includes(badWords)) {
      return res.status(400).json({ error: 'Content contains prohibited words' });
    }
    // Save content to BookContent
    await BookContent.deleteMany({ bookId });
    for (let i = 0; i < content.length; i++) {
      await BookContent.create({ bookId, pageNumber: i + 1, text: content[i] });
    }
    // Save book metadata
    const updateDoc = {
      bookId,
      title,
      author: req.body.author || 'Anonymous',
      playerId,
      coverId: coverId || '6047363187',
      status: req.body.status || 'Draft',
      published: req.body.published || false,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pageCount: content.length,
    };
    const existing = await Book.findOne({ bookId });
    if (existing) {
      updateDoc.upvotes = existing.upvotes || 0;
      updateDoc.views = existing.views || 0;
      updateDoc.voters = existing.voters || [];
      updateDoc.comments = existing.comments || [];
      updateDoc.reports = existing.reports || [];
    }
    const book = await Book.findOneAndUpdate({ bookId }, updateDoc, { upsert: true, new: true });
    res.status(200).json({ message: 'Book saved', bookId: book.bookId, book });
  } catch (err) {
    console.error('Error saving book:', err);
    res.status(500).json({ error: 'Failed to save book' });
  }
});

// Delete a book by bookId
router.delete('/api/books/:bookId', async (req, res) => {
  try {
    const bookId = req.params.bookId;
    console.log('[DELETE] bookId param:', bookId);
    await BookContent.deleteMany({ bookId });
    const deleted = await Book.findOneAndDelete({ bookId });
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
    const { playerId, glowingBook, customCover } = req.body;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }
    const draftBook = await Book.findOne({ bookId, playerId, status: 'Draft', published: false });
    if (!draftBook) {
      return res.status(404).json({ success: false, message: 'Draft book not found or already published' });
    }
    const publishedBook = await Book.findOneAndUpdate(
      { bookId },
      {
        status: 'Published',
        published: true,
        glowingBook: !!glowingBook,
        customCover: !!customCover,
        updatedAt: new Date().toISOString()
      },
      { new: true }
    );
    console.log(`[PUBLISH] Book ${bookId} published with add-ons:`, { glowingBook, customCover });
    res.json({ success: true, message: 'Book published successfully!', book: publishedBook });
  } catch (err) {
    console.error('Error publishing book:', err);
    res.status(500).json({ error: 'Failed to publish book' });
  }
});

// Fetch user's public Decal assets
router.get('/api/user-decals/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const url = `https://catalog.roblox.com/v1/search/items?category=Decal&creatorTargetId=${userId}&limit=30&sortOrder=Desc`;
    const robloxRes = await axios.get(url);
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
  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

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
  } catch (err) {
    console.error('Error processing vote:', err);
    res.status(500).json({ error: 'Failed to process vote' });
  }
});

router.post('/api/views', async (req, res) => {
  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { playerId, bookId } = req.body;
    if (!playerId || !bookId) {
      return res.status(400).json({ error: 'playerId and bookId required' });
    }
    const today = (new Date()).toISOString().slice(0, 10); // YYYY-MM-DD

    const exists = await View.findOne({ playerId, bookId, date: today });
    if (exists) {
      const book = await Book.findOne({ bookId });
      return res.status(200).json({ success: true, duplicate: true, views: book?.views ?? 0 });
    }

    await View.create({ playerId, bookId, date: today });
    const updatedBook = await Book.findOneAndUpdate(
      { bookId },
      { $inc: { views: 1 } },
      { new: true }
    );
    return res.json({ success: true, duplicate: false, views: updatedBook?.views ?? 0 });
  } catch (err) {
    console.error('Failed to record view:', err);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

// Store or update playtime for a player
router.post('/api/playtime', async (req, res) => {
  try {
    const { playerId, minutes, username, thumbnail } = req.body;
    if (!playerId || minutes == null) return res.status(400).json({ error: "playerId and minutes are required" });

    // Use upsert to keep the leaderboard updated
    await Playtime.findOneAndUpdate(
      { playerId },
      { $set: { minutes, username, thumbnail } },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating playtime:', err);
    res.status(500).json({ error: 'Failed to update playtime' });
  }
});

// Get the playtime leaderboard (top 10)
router.get('/api/playtime/leaderboard', async (req, res) => {
  try {
    const topPlayers = await Playtime.find().sort({ minutes: -1 }).limit(10).lean();
    res.json(topPlayers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// POST /api/books/:bookId/comments
// -- Only KEEP this one --
// POST /api/books/:bookId/comments
router.post('/api/books/:bookId/comments', async (req, res) => {
  const { playerId, username, text } = req.body;
  if (!playerId || !text || !username) return res.status(400).json({ error: 'Missing fields' });

  // Fetch the book first
  const book = await Book.findOne({ bookId: req.params.bookId });
  if (!book) return res.status(404).json({ error: 'Book not found' });

  // Check if player has already commented
  const alreadyCommented = (book.comments || []).some(c => String(c.playerId) === String(playerId));
  if (alreadyCommented) {
    return res.status(403).json({ error: 'You have already commented on this book.' });
  }

  // Otherwise, add new comment
  const newComment = {
    playerId,
    username,
    text,
    createdAt: new Date().toISOString(),
    likes: [playerId],  // Auto-upvote own comment
    dislikes: [],
  };
  book.comments.push(newComment);
  await book.save();
  res.json({ success: true, comments: book.comments });
});

// GET /api/books/:bookId/comments
router.get('/api/books/:bookId/comments', async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) return res.status(404).json({ error: "Book not found" });
    const sorted = [...(book.comments || [])].sort((a, b) =>
      (b.likes?.length || 0) - (a.likes?.length || 0) || new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json({ success: true, comments: sorted });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// Get leaderboard for Most Books Written
router.get('/api/leaderboard/books-written', async (req, res) => {
  const data = await Book.aggregate([
    { $group: { _id: "$playerId", count: { $sum: 1 }, author: { $first: "$author" } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);
  res.json(data);
});

// Award XP
// POST /api/xp
router.post('/api/xp', async (req, res) => {
  try {
    const { playerId, amount, username } = req.body;
    if (!playerId || !username || typeof amount !== 'number' || amount < 0) {
      return res.status(400).json({ error: 'playerId, username, and a non-negative amount are required' });
    }
    const xp = await XP.findOneAndUpdate(
      { playerId },
      { $inc: { xp: Math.floor(amount) }, $set: { username } },
      { upsert: true, new: true }
    );
    res.json({ success: true, xp: xp.xp });
  } catch (err) {
    console.error('Error awarding XP:', err);
    res.status(500).json({ error: 'Failed to award XP' });
  }
});

// Leaderboard
router.get('/api/xp/leaderboard', async (req, res) => {
  const top = await XP.find().sort({ xp: -1 }).limit(10).lean();
  res.json(top);
});

// Top Reviewer: player with most comments (all books)
router.get('/api/leaderboard/top-reviewers', async (req, res) => {
  const books = await Book.find({}, { comments: 1 }).lean();
  const reviewCounts = {};
  books.forEach(book => {
    (book.comments || []).forEach(c => {
      if (!reviewCounts[c.playerId]) reviewCounts[c.playerId] = { count: 0, username: c.username };
      reviewCounts[c.playerId].count += 1;
    });
  });
  // Convert to array and sort
  const arr = Object.entries(reviewCounts).map(([playerId, data]) => ({
    playerId, username: data.username, count: data.count
  })).sort((a, b) => b.count - a.count).slice(0, 10);
  res.json(arr);
});

// Most Popular Author (total upvotes across all their books)
router.get('/api/leaderboard/most-popular-author', async (req, res) => {
  const data = await Book.aggregate([
    { $match: { published: true } },
    { $group: { _id: "$playerId", author: { $first: "$author" }, totalUpvotes: { $sum: "$upvotes" } } },
    { $sort: { totalUpvotes: -1 } },
    { $limit: 10 }
  ]);
  res.json(data);
});

// Award XP for reading a book (only once per book per day)
router.post('/api/xp/bookread', async (req, res) => {
  try {
    const { playerId, username, bookId, title } = req.body;
    if (!playerId || !bookId || !username) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Check if this player already read this book today
    const existing = await ReadLog.findOne({ playerId, bookId, date: today });
    if (existing) {
      return res.json({ success: true, awarded: false, xp: 0 });
    }

    // Award XP securely
    const XP = require('../models/XP');
    const xp = await XP.findOneAndUpdate(
      { playerId },
      {
        $inc: { xp: 5 },
        $setOnInsert: { username },
      },
      { upsert: true, new: true }
    );

    // Save read log to prevent re-awards
    await ReadLog.create({ playerId, bookId, date: today });

    res.json({ success: true, awarded: true, xp: 5 });
  } catch (err) {
    console.error('❌ Error awarding book read XP:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.use('/api', bomRoute); // ⬅️ This mounts /api/bookofmormon

router.get('/api/bookofmormon', async (req, res) => {
  const { book, chapter } = req.query;
  const query = {};
  if (book) query.book = book;
  if (chapter) query.chapter = Number(chapter);
  const scriptures = await Scripture.find(query).lean();
  res.json(scriptures);
});

router.use('/api', bomRoute);

module.exports = router;