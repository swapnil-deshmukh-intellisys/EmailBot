const express = require('express');
const { state, runEmailCampaign, resetCampaignState } = require('../services/campaignStateService');

const router = express.Router();

router.post('/start-campaign', (req, res) => {
  if (state.emailSendingState.isRunning) {
    return res.status(400).json({ error: 'Campaign already running' });
  }

  resetCampaignState();
  runEmailCampaign();

  res.json({ success: true, message: 'Campaign started' });
});

router.post('/stop-campaign', (req, res) => {
  state.emailSendingState.isRunning = false;
  state.emailSendingState.currentEmail = null;
  res.json({ success: true, message: 'Campaign stopped' });
});

router.post('/clear-logs', (req, res) => {
  state.emailSendingState.logs = [];
  resetCampaignState();
  res.json({ success: true, message: 'Logs cleared' });
});

router.get('/campaign-status', (req, res) => {
  res.json({
    isRunning: state.emailSendingState.isRunning,
    currentEmail: state.emailSendingState.currentEmail,
    stats: state.emailSendingState.stats,
    logs: state.emailSendingState.logs.slice(-50)
  });
});

module.exports = router;
