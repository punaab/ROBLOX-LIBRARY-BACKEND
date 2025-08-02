// server/routes/bookofmormon.js
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
        res.json(scriptures);
    } catch (err) {
        console.error('Error fetching Book of Mormon:', err);
        res.status(500).json({ error: 'Failed to fetch scriptures' });
    }
});

module.exports = router;
