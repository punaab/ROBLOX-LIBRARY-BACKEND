const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// Trust proxy so rate-limiter sees real IP (Railway/Heroku style proxies)
app.set('trust proxy', 1);
app.use(cors());

// --- Health BEFORE anything heavy or rate-limited ---
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// --- JSON parsing with safe verify (don’t write to res here) ---
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    // Only attempt to parse if content-type is JSON
    const ct = req.headers['content-type'] || '';
    if (ct.includes('application/json') && buf && buf.length) {
      try { JSON.parse(buf.toString('utf8')); } // throw if invalid
      catch { throw new SyntaxError('Invalid JSON'); }
    }
  }
}));

// Parse-error middleware (handles SyntaxError thrown above)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.message === 'Invalid JSON') {
    return res.status(400).json({ error: 'Invalid JSON format' });
  }
  return next(err);
});

// --- MongoDB setup ---
const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error('❌ MONGO_URL is not set. Set environment variable in Railway.');
} else {
  mongoose.connect(MONGO_URL)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch(err => {
      // Don’t exit; keep the process alive so platform doesn’t SIGTERM loop
      console.error('❌ MongoDB connection error (continuing to run):', err.message);
    });

  mongoose.connection.on('error', err => {
    console.error('❌ MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected');
  });
}

// --- Rate limit (AFTER /health) ---
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please slow down.'
});
app.use(limiter);

// --- Routes ---
const routes = require('./routes/index');
const bibleRoutes = require('./routes/bible');
const bookOfMormonRoutes = require('./routes/bookofmormon');
const migrationRoutes = require('./routes/migration');

app.use('/', routes);
app.use('/api/bible', bibleRoutes);
app.use('/api/bom', bookOfMormonRoutes);
app.use('/api/migration', migrationRoutes);

// --- Static files ---
app.use(express.static(path.join(__dirname, 'public')));

// 404 page
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || String(err));
  res.status(500).json({ error: message, timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
['SIGTERM', 'SIGINT'].forEach(signal => {
  process.on(signal, () => {
    console.log(`🛑 ${signal} received, shutting down gracefully`);
    server.close(() => {
      console.log('✅ HTTP server closed');
      mongoose.connection.close(false).then(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      }).catch(() => process.exit(0));
    });
  });
});

module.exports = app;
