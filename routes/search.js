const express = require('express');
const router = express.Router();
const Book = require('../models/Book');

// GET /api/search?q=searchTerm
router.get('/', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Query too short' });
    }

    const results = await Book.find({
      published: true,
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { author: { $regex: query, $options: 'i' } }
      ]
    }).lean();

    res.json(results);
  } catch (err) {
    console.error("❌ Search error:", err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
