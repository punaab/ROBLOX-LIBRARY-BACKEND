const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Setup
mongoose.connect(process.env.MONGO_URL);

const Book = mongoose.model('Book', {
  bookId: String,
  title: String,
  author: String,
  content: [String],
  coverId: String,
  upvotes: Number,
  comments: Array,
  reports: Array,
  createdAt: String
});

app.get('/api/books', async (req, res) => {
  const books = await Book.find();
  res.json(books);
});

app.get('/api/books/:bookId', async (req, res) => {
  const book = await Book.findOne({ bookId: req.params.bookId });
  res.json(book);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

