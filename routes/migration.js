const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Scripture = require('../models/Scripture');

// Migration endpoint
router.post('/migrate-book-content', async (req, res) => {
  try {
    console.log('Starting book content migration...');
    
    // Read JSON file
    const dataPath = path.join(__dirname, '../data/book-of-mormon.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // Transform and insert data
    const scriptures = [];
    data.books.forEach(book => {
      book.chapters.forEach(chapter => {
        chapter.verses.forEach(verse => {
          scriptures.push({
            book: book.book,
            chapter: chapter.chapter,
            verse: verse.verse,
            text: verse.text,
            reference: verse.reference
          });
        });
      });
    });
    
    // Clear existing scriptures first (optional)
    await Scripture.deleteMany({});
    console.log('Cleared existing scriptures');
    
    // Insert new scriptures
    const result = await Scripture.insertMany(scriptures);
    console.log('Imported', result.length, 'scriptures');
    
    res.json({
      success: true,
      message: `Successfully imported ${result.length} scriptures`,
      count: result.length
    });
    
  } catch (err) {
    console.error('Migration error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Get migration status
router.get('/migrate-status', async (req, res) => {
  try {
    const count = await Scripture.countDocuments();
    res.json({
      success: true,
      scriptureCount: count
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router; 