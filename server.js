const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.set('trust proxy', 1); // trust first proxy
app.use(cors());

// Enhanced JSON parsing with error handling
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON format' });
      throw new Error('Invalid JSON');
    }
  }
}));

// Error handling middleware for JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  next();
});

// MongoDB Setup
mongoose.connect(process.env.MONGO_URL);

// Example: 100 requests per 10 minutes per IP
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,
  standardHeaders: true, 
  legacyHeaders: false,    
  message: "Too many requests, please slow down."
});

// Apply to ALL routes:
app.use(limiter);

// Import routes
const routes = require('./routes/index');     // your general app/book routes
const bibleRoutes = require('./routes/bible'); // your new Bible API proxy routes

// Use routes
app.use('/', routes);
app.use('/api/bible', bibleRoutes);  // <-- This line is new

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
