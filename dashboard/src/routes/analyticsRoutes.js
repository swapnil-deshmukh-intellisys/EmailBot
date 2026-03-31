const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json({
    totalSent: 1247,
    totalFailed: 23,
    successRate: 87.5,
    bounceRate: 2.3,
    dailyStats: {
      Mon: 120,
      Tue: 150,
      Wed: 180,
      Thu: 200,
      Fri: 170,
      Sat: 220,
      Sun: 190
    }
  });
});

module.exports = router;
