// server/routes/bookofmormon.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const bomData = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/bookofmormon.json'))
);

router.get('/bookofmormon', (req, res) => {
  res.json(bomData);
});

module.exports = router;

