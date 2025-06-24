const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Setup
mongoose.connect(process.env.MONGO_URL);

// Import routes
const routes = require('./routes/index');

// Use routes
app.use('/', routes);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views/404.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
