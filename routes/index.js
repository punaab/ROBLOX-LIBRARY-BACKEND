const express = require('express');
const path = require('path');
const router = express.Router();
const Book = require('../models/Book');
const BookContent = require('../models/BookContent');
const View = require('../models/View');
const Playtime = require('../models/Playtime');
const XP = require('../models/XP');
const ReadLog = require('../models/ReadLog');
const axios = require('axios');
const searchRoutes = require('./search');
const bomRoute = require('./bookofmormon');
const NodeCache = require('node-cache');
const bookCache = new NodeCache({ stdTTL: 300 }); // 5-minute TTL
const Bookmark = require('../models/Bookmark');

let mostBooksReadCache = [];
let lastUpdate = 0;

// Search
router.use('/api/search', searchRoutes);

// Book of Mormon
router.use('/api/bookofmormon', bomRoute);

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

router.post('/api/books/read', async (req, res) => {
  try {
    const { playerId, username, bookId, title } = req.body;
    if (!playerId || !bookId) {
      return res.status(400).json({ error: 'playerId and bookId are required' });
    }
    await ReadLog.create({ playerId, bookId, date: new Date().toISOString().split('T')[0], title });
    res.json({ success: true });
  } catch (err) {
    console.error('Error recording book read:', err);
    res.status(500).json({ error: 'Failed to record book read' });
  }
});

router.get('/api/playtime', async (req, res) => {
  try {
    const { playerId } = req.query;
    if (!playerId) {
      return res.status(400).json({ error: 'playerId is required' });
    }
    const playtime = await Playtime.findOne({ playerId }).lean() || { minutes: 0 };
    res.json({ success: true, minutes: playtime.minutes });
  } catch (err) {
    console.error('Error fetching playtime:', err);
    res.status(500).json({ error: 'Failed to fetch playtime' });
  }
});

// GET /leaderboard/most-books-read
router.get('/api/leaderboard/most-books-read', async (req, res) => {
  try {
    await updateMostBooksReadCache();
    res.json(mostBooksReadCache);
  } catch (err) {
    console.error("❌ Failed to fetch most-books-read leaderboard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/leaderboard/top-reviewers
router.get('/api/leaderboard/top-reviewers', async (req, res) => {
  try {
    const books = await Book.find({}, { comments: 1 }).lean();
    const reviewCounts = {};
    books.forEach(book => {
      (book.comments || []).forEach(c => {
        if (!reviewCounts[c.playerId]) reviewCounts[c.playerId] = { count: 0, username: c.username };
        reviewCounts[c.playerId].count += 1;
      });
    });
    const arr = Object.entries(reviewCounts)
      .map(([playerId, data]) => ({
        playerId,
        username: data.username,
        count: data.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    res.json(arr);
  } catch (err) {
    console.error("❌ Failed to fetch top-reviewers leaderboard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/leaderboard/books-written
router.get('/api/leaderboard/books-written', async (req, res) => {
  try {
    const data = await Book.aggregate([
      { $group: { _id: "$playerId", count: { $sum: 1 }, author: { $first: "$author" } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Failed to fetch books-written leaderboard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/leaderboard/most-popular-author
router.get('/api/leaderboard/most-popular-author', async (req, res) => {
  try {
    const data = await Book.aggregate([
      { $match: { published: true } },
      { $group: { _id: "$playerId", author: { $first: "$author" }, totalUpvotes: { $sum: "$upvotes" } } },
      { $sort: { totalUpvotes: -1 } },
      { $limit: 10 }
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Failed to fetch most-popular-author leaderboard:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/xp/leaderboard
router.get('/api/xp/leaderboard', async (req, res) => {
  try {
    const top = await XP.find().sort({ xp: -1 }).limit(10).lean();
    res.json(top);
  } catch (err) {
    console.error("❌ Failed to fetch xp leaderboard:", err);
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



// Create or update a book
router.post('/api/books', async (req, res) => {
  try {
    const { bookId, title, content, playerId, author, coverId, genres, createdAt } = req.body;
    if (!bookId || !title || !content || !playerId) {
      return res.status(400).json({ error: 'Missing required fields: bookId, title, content, playerId' });
    }
    if (!Array.isArray(content) || content.some(page => typeof page !== 'string' || page.length === 0 || page.length > 1000)) {
      return res.status(400).json({ error: 'Invalid content: must be array of non-empty strings, max 1000 chars per page' });
    }
    if (title.length > 100) {
      return res.status(400).json({ error: 'Title too long (max 100 chars)' });
    }
    if (!Array.isArray(genres) || genres.length > 3 || genres.some(g => typeof g !== 'string' || g.length === 0)) {
      return res.status(400).json({ error: 'Invalid genres: must be an array of up to 3 non-empty strings' });
    }
    const badWords = ['inappropriate', 'offensive'];
    const titleHasBad = badWords.some(w => title.toLowerCase().includes(w));
    const contentHasBad = Array.isArray(content) && content.some(page =>
      badWords.some(w => (page || '').toLowerCase().includes(w))
    );
    if (titleHasBad || contentHasBad) {
      return res.status(400).json({ error: 'Content contains prohibited words' });
    }    
    await BookContent.deleteMany({ bookId });

    let wroteAnyPage = false;
    for (let i = 0; i < content.length; i++) {
      const raw = (content[i] ?? "").toString();
      const text = raw.trim().length > 0 ? raw : "Untitled Page"; // <-- ensure non-empty
      await BookContent.create({ bookId, pageNumber: i + 1, text });
      wroteAnyPage = true;
    }
    if (!wroteAnyPage) {
      await BookContent.create({ bookId, pageNumber: 1, text: "Untitled Page" });
    }
    
    const updateDoc = {
      bookId,
      title,
      author: author || 'Anonymous',
      playerId,
      coverId: coverId || '6047363187',
      genres: genres || [],
      status: 'Draft',
      published: false,
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
    if (!userId || isNaN(userId)) {
      console.log(`Invalid user ID provided: ${userId}`);
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    console.log(`Fetching decals for user ID: ${userId}`);
    let robloxRes = null;
    try {
      const url = `https://catalog.roblox.com/v1/search/items?category=Decal&creatorTargetId=${userId}&limit=30&sortOrder=Desc`;
      robloxRes = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Referer': 'https://www.roblox.com/'
        },
        timeout: 10000
      });
      console.log(`Successfully fetched decals using catalog API for user ${userId}, found ${robloxRes.data.data?.length || 0} items`);
    } catch (err) {
      console.log(`Catalog API failed for user ${userId}:`, err.response?.status);
      if (err.response?.status === 400) {
        return res.status(400).json({ success: false, error: 'Invalid request to Roblox API' });
      } else if (err.response?.status === 429) {
        return res.status(429).json({ success: false, error: 'Rate limited by Roblox API' });
      }
      return res.status(404).json({ success: false, error: 'User not found or no public decals' });
    }
    if (robloxRes && robloxRes.data && robloxRes.data.data) {
      const decals = robloxRes.data.data.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        imageUrl: item.thumbnailUrl || `https://www.roblox.com/asset-thumbnail/image?assetId=${item.id}&width=150&height=150&format=png`
      }));
      res.json({ success: true, decals });
    } else {
      res.json({ success: false, decals: [] });
    }
  } catch (err) {
    console.error('Error fetching user decals:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch decals' });
  }
});

// GET /api/votes
router.get('/api/votes', async (req, res) => {
  try {
    const { playerId, bookId } = req.query;
    if (!playerId || !bookId) {
      return res.status(400).json({ error: "Missing playerId or bookId" });
    }
    const book = await Book.findOne({ bookId });
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    const hasVoted = (book.voters || []).includes(playerId);
    res.json({ voted: hasVoted });
  } catch (err) {
    console.error('Error checking vote:', err);
    res.status(500).json({ error: 'Failed to check vote' });
  }
});

// POST /api/votes
router.post('/api/votes', async (req, res) => {
  try {
    const { playerId, bookId, voteType } = req.body;
    if (!playerId || !bookId || voteType !== "up") {
      return res.status(400).json({ error: "Missing playerId, bookId, or invalid voteType" });
    }
    const book = await Book.findOne({ bookId });
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
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

// POST /api/views
router.post('/api/views', async (req, res) => {
  try {
    const { playerId, bookId } = req.body;
    if (!playerId || !bookId) {
      return res.status(400).json({ error: 'playerId and bookId required' });
    }
    const today = new Date().toISOString().slice(0, 10);
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

// POST /api/playtime
router.post('/api/playtime', async (req, res) => {
  try {
    const { playerId, minutes, username, thumbnail } = req.body;
    if (!playerId || minutes == null) {
      return res.status(400).json({ error: "playerId and minutes are required" });
    }
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

// GET /api/playtime/leaderboard
router.get('/api/playtime/leaderboard', async (req, res) => {
  try {
    const topPlayers = await Playtime.find().sort({ minutes: -1 }).limit(10).lean();
    res.json(topPlayers);
  } catch (err) {
    console.error('Error fetching playtime leaderboard:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

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
    res.json({ success: true, xp: xp.xp }); // Fixed typo
  } catch (err) {
    console.error('Error awarding XP:', err);
    res.status(500).json({ error: 'Failed to award XP' });
  }
});

// POST /api/xp/bookread
router.post('/api/xp/bookread', async (req, res) => {
  try {
    const { playerId, username, bookId, title } = req.body;
    if (!playerId || !bookId || !username) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const today = new Date().toISOString().split('T')[0];
    const existing = await ReadLog.findOne({ playerId, bookId, date: today });
    if (existing) {
      return res.json({ success: true, awarded: false, xp: 0 });
    }
    const xp = await XP.findOneAndUpdate(
      { playerId },
      { $inc: { xp: 5 }, $setOnInsert: { username } },
      { upsert: true, new: true }
    );
    await ReadLog.create({ playerId, bookId, date: today });
    res.json({ success: true, awarded: true, xp: 5 });
  } catch (err) {
    console.error('❌ Error awarding book read XP:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/books/:bookId/comments
router.post('/api/books/:bookId/comments', async (req, res) => {
  try {
    const { playerId, username, text } = req.body;
    if (!playerId || !text || !username) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const book = await Book.findOne({ bookId: req.params.bookId });
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }
    const alreadyCommented = (book.comments || []).some(c => String(c.playerId) === String(playerId));
    if (alreadyCommented) {
      return res.status(403).json({ error: 'You have already commented on this book.' });
    }
    const newComment = {
      playerId,
      username,
      text,
      createdAt: new Date().toISOString(),
      likes: [playerId],
      dislikes: [],
    };
    book.comments = book.comments || [];
    book.comments.push(newComment);
    await book.save();
    res.json({ success: true, comments: book.comments });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// GET /api/books/:bookId/comments
router.get('/api/books/:bookId', async (req, res) => {
  try {
    const book = await Book.findOne({ bookId: req.params.bookId }).lean();
    if (!book) return res.status(404).json({ error: 'Book not found' });

    const contentDocs = await BookContent.find({ bookId: req.params.bookId })
      .sort({ pageNumber: 1 }).lean();

    const content = contentDocs.map(c => c.text);
    book.content = content.length > 0 ? content : ["Untitled Page"]; // <-- fallback

    res.json(book);
  } catch (err) {
    console.error('Error fetching book:', err);
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// POST /api/books/:bookId/purchase-pages
router.post('/api/books/:bookId/purchase-pages', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { playerId, additionalPages } = req.body;
    if (!playerId || !additionalPages || typeof additionalPages !== 'number' || additionalPages <= 0) {
      return res.status(400).json({ error: 'playerId and a positive additionalPages are required' });
    }
    const book = await Book.findOne({ bookId, playerId, status: 'Draft' });
    if (!book) {
      return res.status(404).json({ error: 'Draft book not found' });
    }
    const updatedBook = await Book.findOneAndUpdate(
      { bookId },
      { $inc: { pageCount: additionalPages }, $set: { updatedAt: new Date().toISOString() } },
      { new: true }
    );
    res.json({ success: true, message: 'Pages added successfully', book: updatedBook });
  } catch (err) {
    console.error('Error purchasing pages:', err);
    res.status(500).json({ error: 'Failed to purchase pages' });
  }
});

router.post('/api/bookmarks', async (req, res) => {
  try {
    const { playerId, bookId, page } = req.body;
    if (!playerId || !bookId || !page) {
      return res.status(400).json({ error: 'playerId, bookId, and page are required' });
    }
    const bookmark = await Bookmark.create({ playerId, bookId, page });
    res.json({ success: true, bookmark });
  } catch (err) {
    console.error('Error saving bookmark:', err);
    res.status(500).json({ error: 'Failed to save bookmark' });
  }
});


module.exports = router;