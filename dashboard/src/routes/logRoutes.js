const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { state } = require('../services/campaignStateService');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(state.emailLogs);
});

module.exports = router;
