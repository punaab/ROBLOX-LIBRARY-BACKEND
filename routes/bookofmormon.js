const express = require('express');
const router = express.Router();
const Scripture = require('../models/Scripture');

router.get('/', async (req, res) => {
  try {
    const { book, chapter } = req.query;
    const query = {};
    if (book) query.book = book;
    if (chapter) query.chapter = Number(chapter);
    const scriptures = await Scripture.find(query).lean();
    const books = {};
    scriptures.forEach(s => {
      if (!books[s.book]) books[s.book] = { book: s.book, chapters: {} };
      if (!books[s.book].chapters[s.chapter]) books[s.book].chapters[s.chapter] = { chapter: s.chapter, verses: [] };
      books[s.book].chapters[s.chapter].verses.push({ reference: s.reference || `${s.book} ${s.chapter}:${s.verse}`, text: s.text });
    });
    const result = { books: Object.values(books).map(b => ({ book: b.book, chapters: Object.values(b.chapters) })) };
    res.json(result);
  } catch (err) {
    console.error('Error fetching Book of Mormon:', err);
    res.status(500).json({ error: 'Failed to fetch scriptures' });
  }
});

module.exports = router;