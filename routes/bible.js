const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_BIBLE_KEY = process.env.API_BIBLE_KEY;
const BASE_URL = "https://api.scripture.api.bible/v1";
const BIBLE_ID = "de4e12af7f28f599-01"; // KJV

// Get all books
router.get('/bible/books', async (req, res) => {
  const url = `${BASE_URL}/bibles/${BIBLE_ID}/books`;
  try {
    const result = await axios.get(url, {
      headers: { "api-key": API_BIBLE_KEY }
    });
    res.json(result.data.data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch books" });
  }
});

// Get chapters for a book
router.get('/bible/books/:bookId/chapters', async (req, res) => {
  const { bookId } = req.params;
  const url = `${BASE_URL}/bibles/${BIBLE_ID}/books/${bookId}/chapters`;
  try {
    const result = await axios.get(url, {
      headers: { "api-key": API_BIBLE_KEY }
    });
    res.json(result.data.data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch chapters" });
  }
});

// Get verses for a chapter
router.get('/bible/chapters/:chapterId/verses', async (req, res) => {
  const { chapterId } = req.params;
  const url = `${BASE_URL}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`;
  try {
    const result = await axios.get(url, {
      headers: { "api-key": API_BIBLE_KEY }
    });
    res.json(result.data.data);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch verses" });
  }
});

module.exports = router;
