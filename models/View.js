// models/View.js
const mongoose = require('mongoose');
const viewSchema = new mongoose.Schema({
  playerId: String,
  bookId: String,
  date: String // e.g. '2024-07-13'
});
module.exports = mongoose.model('View', viewSchema);

// in routes/index.js or routes/views.js
const View = require('../models/View');

// POST /api/views
router.post('/api/views', async (req, res) => {
  try {
    const { playerId, bookId } = req.body;
    if (!playerId || !bookId) {
      return res.status(400).json({ error: 'playerId and bookId required' });
    }
    const today = (new Date()).toISOString().slice(0, 10); // YYYY-MM-DD

    // Has this player viewed this book today?
    const exists = await View.findOne({ playerId, bookId, date: today });
    if (exists) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    // Record the view
    await View.create({ playerId, bookId, date: today });

    // Increment views in Book
    await Book.updateOne({ bookId }, { $inc: { views: 1 } });

    return res.json({ success: true, duplicate: false });
  } catch (err) {
    console.error('Failed to record view:', err);
    res.status(500).json({ error: 'Failed to record view' });
  }
});
