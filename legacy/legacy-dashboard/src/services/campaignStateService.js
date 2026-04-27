const { sendRealEmails, setUpdateCallback } = require('../../email_bot_real');

const state = {
  campaigns: [
    { id: 1, name: 'AI Leadership Campaign', status: 'Active', sendLimit: 2000, delayBetweenEmails: 60 },
    { id: 2, name: 'Robotics Innovation', status: 'Draft', sendLimit: 1500, delayBetweenEmails: 45 },
    { id: 3, name: 'Tech Summit 2026', status: 'Paused', sendLimit: 3000, delayBetweenEmails: 30 }
  ],
  emailLogs: [
    { email: 'john@example.com', status: 'Sent', time: '2026-03-02 14:52:00', responseCode: '200' },
    { email: 'jane@company.com', status: 'Failed', time: '2026-03-02 14:53:00', responseCode: '550' },
    { email: 'mike@startup.io', status: 'Rate Limited', time: '2026-03-02 14:54:00', responseCode: '429' },
    { email: 'sarah@tech.com', status: 'Sent', time: '2026-03-02 14:55:00', responseCode: '200' },
    { email: 'alex@ai.com', status: 'Sent', time: '2026-03-02 14:56:00', responseCode: '200' },
    { email: 'lisa@robotics.com', status: 'Blocked', time: '2026-03-02 14:57:00', responseCode: '554' }
  ],
  emailSendingState: {
    isRunning: false,
    currentEmail: null,
    stats: {
      totalSent: 0,
      totalFailed: 0,
      totalRemaining: 0,
      currentBatch: 0,
      sendingSpeed: 0
    },
    logs: []
  }
};

function broadcastEvent(type, data) {
  state.emailSendingState.logs.push({
    type,
    message: data.message,
    email: data.email,
    timestamp: new Date().toLocaleTimeString()
  });

  if (state.emailSendingState.logs.length > 100) {
    state.emailSendingState.logs = state.emailSendingState.logs.slice(-100);
  }
}

async function runEmailCampaign() {
  try {
    setUpdateCallback((type, message, email) => {
      broadcastEvent(type, { message, email });

      if (type === 'sending') {
        state.emailSendingState.currentEmail = email;
      } else if (type === 'waiting') {
        state.emailSendingState.currentEmail = null;
      } else if (type === 'success' && email) {
        state.emailSendingState.currentEmail = null;
        state.emailSendingState.stats.totalSent += 1;
      } else if (type === 'failed' && email) {
        state.emailSendingState.currentEmail = null;
        state.emailSendingState.stats.totalFailed += 1;
      }
    });

    state.emailSendingState.isRunning = true;
    broadcastEvent('info', { message: 'Starting email campaign from clients_new.xlsx...' });

    const results = await sendRealEmails();

    state.emailSendingState.stats.totalSent = results.filter((r) => r.success).length;
    state.emailSendingState.stats.totalFailed = results.filter((r) => !r.success).length;
    state.emailSendingState.stats.totalRemaining = 0;
    state.emailSendingState.currentEmail = null;
    state.emailSendingState.isRunning = false;
  } catch (error) {
    state.emailSendingState.isRunning = false;
    state.emailSendingState.currentEmail = null;
    broadcastEvent('error', { message: `Campaign error: ${error.message}` });
  }
}

function resetCampaignState() {
  state.emailSendingState.stats = {
    totalSent: 0,
    totalFailed: 0,
    totalRemaining: 0,
    currentBatch: 0,
    sendingSpeed: 0
  };
  state.emailSendingState.logs = [];
}

module.exports = {
  state,
  runEmailCampaign,
  resetCampaignState
};
