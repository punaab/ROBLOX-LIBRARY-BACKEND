const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
