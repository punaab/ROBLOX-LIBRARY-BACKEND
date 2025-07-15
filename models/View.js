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
        // Optionally return current count
        const book = await Book.findOne({ bookId });
        return res.status(200).json({ success: true, duplicate: true, views: book?.views ?? 0 });
      }
  
      // Record the view
      await View.create({ playerId, bookId, date: today });
  
      // Increment views in Book
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
  
