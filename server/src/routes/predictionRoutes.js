const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Placeholder for future AI prediction features
router.get('/', protect, (req, res) => {
  res.json({ message: 'Predictions route - Coming soon with AI model' });
});

module.exports = router;
