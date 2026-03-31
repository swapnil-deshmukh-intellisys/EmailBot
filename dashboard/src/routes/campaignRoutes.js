const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { state } = require('../services/campaignStateService');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  res.json(state.campaigns);
});

router.post('/', authenticateToken, (req, res) => {
  const campaign = {
    id: state.campaigns.length + 1,
    ...req.body,
    createdBy: req.user.userId
  };
  state.campaigns.push(campaign);
  res.json(campaign);
});

router.post('/send-emails', authenticateToken, (req, res) => {
  const { campaignId, emails = [] } = req.body;
  res.json({
    message: 'Email sending started',
    campaignId,
    estimatedTime: emails.length * 60
  });
});

module.exports = router;
