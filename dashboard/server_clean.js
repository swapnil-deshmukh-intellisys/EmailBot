const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

// Real-time email sending state
let emailSendingState = {
  isRunning: false,
  currentEmail: null,
  stats: {
    totalSent: 0,
    totalFailed: 0,
    totalRemaining: 0,
    currentBatch: 0
  },
  logs: []
};

// Broadcast events to frontend
const broadcastEvent = (type, message, email = null) => {
  const logEntry = {
    type,
    message,
    email,
    timestamp: new Date().toLocaleTimeString()
  };
  
  emailSendingState.logs.push(logEntry);
  
  // Keep only last 100 logs
  if (emailSendingState.logs.length > 100) {
    emailSendingState.logs = emailSendingState.logs.slice(-100);
  }
  
  console.log(`[${type.toUpperCase()}] ${message}${email ? ' (' + email + ')' : ''}`);
};

// Real email sending function
const sendRealEmails = async () => {
  try {
    const { sendRealEmails, setUpdateCallback } = require('./email_bot_real');
    
    // Set up callback for real-time updates
    setUpdateCallback((type, message, email) => {
      broadcastEvent(type, message, email);
      
      // Update stats
      if (type === 'sending') {
        emailSendingState.currentEmail = email;
        emailSendingState.stats.currentBatch++;
      } else if (type === 'success' && email) {
        emailSendingState.currentEmail = null;
        emailSendingState.stats.totalSent++;
        emailSendingState.stats.totalRemaining--;
      } else if (type === 'failed' && email) {
        emailSendingState.currentEmail = null;
        emailSendingState.stats.totalFailed++;
        emailSendingState.stats.totalRemaining--;
      } else if (type === 'waiting') {
        emailSendingState.currentEmail = null;
      }
    });
    
    emailSendingState.isRunning = true;
    broadcastEvent('info', 'Starting email campaign from Excel file...');
    
    // Start real email sending
    const results = await sendRealEmails();
    
    // Final update
    emailSendingState.currentEmail = null;
    emailSendingState.isRunning = false;
    broadcastEvent('success', `Campaign completed! Sent: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}`);
    
  } catch (error) {
    emailSendingState.isRunning = false;
    emailSendingState.currentEmail = null;
    broadcastEvent('error', `Campaign error: ${error.message}`);
  }
};

// API Routes
app.post('/api/start-campaign', (req, res) => {
  if (emailSendingState.isRunning) {
    return res.status(400).json({ error: 'Campaign already running' });
  }
  
  // Reset stats
  emailSendingState.stats = {
    totalSent: 0,
    totalFailed: 0,
    totalRemaining: 0,
    currentBatch: 0
  };
  emailSendingState.logs = [];
  
  // Start campaign in background
  sendRealEmails();
  
  res.json({ success: true, message: 'Campaign started' });
});

app.post('/api/stop-campaign', (req, res) => {
  emailSendingState.isRunning = false;
  emailSendingState.currentEmail = null;
  broadcastEvent('warning', 'Campaign stopped by user');
  res.json({ success: true, message: 'Campaign stopped' });
});

app.post('/api/clear-logs', (req, res) => {
  emailSendingState.logs = [];
  emailSendingState.stats = {
    totalSent: 0,
    totalFailed: 0,
    totalRemaining: 0,
    currentBatch: 0
  };
  res.json({ success: true, message: 'Logs cleared' });
});

app.get('/api/campaign-status', (req, res) => {
  res.json({
    isRunning: emailSendingState.isRunning,
    currentEmail: emailSendingState.currentEmail,
    stats: emailSendingState.stats,
    logs: emailSendingState.logs
  });
});

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/monitor', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'realtime-monitor.html'));
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    campaignEngine: 'ready'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Clean Email Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`📈 Monitor: http://localhost:${PORT}/monitor`);
  console.log(`⚡ Ready for real email sending!`);
});

module.exports = app;
