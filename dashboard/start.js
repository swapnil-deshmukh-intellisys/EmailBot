// Fast startup script - no database dependencies
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Fast middleware setup
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('public'));

// Demo data
const campaigns = [
  { id: 1, name: 'AI Leadership Campaign', status: 'Active', sendLimit: 2000, delayBetweenEmails: 60 },
  { id: 2, name: 'Robotics Innovation', status: 'Draft', sendLimit: 1500, delayBetweenEmails: 45 },
  { id: 3, name: 'Tech Summit 2026', status: 'Paused', sendLimit: 3000, delayBetweenEmails: 30 }
];

const emailLogs = [
  { email: 'john@example.com', status: 'Sent', time: '2026-03-02 14:52:00', responseCode: '200' },
  { email: 'jane@company.com', status: 'Failed', time: '2026-03-02 14:53:00', responseCode: '550' },
  { email: 'mike@startup.io', status: 'Rate Limited', time: '2026-03-02 14:54:00', responseCode: '429' },
  { email: 'sarah@tech.com', status: 'Sent', time: '2026-03-02 14:55:00', responseCode: '200' },
  { email: 'alex@ai.com', status: 'Sent', time: '2026-03-02 14:56:00', responseCode: '200' },
  { email: 'lisa@robotics.com', status: 'Blocked', time: '2026-03-02 14:57:00', responseCode: '554' }
];

// Fast API routes
app.post('/api/auth/login', (req, res) => {
  res.json({ 
    token: 'demo-token', 
    user: { username: 'Admin', role: 'Admin' } 
  });
});

app.get('/api/campaigns', (req, res) => {
  res.json(campaigns);
});

app.get('/api/analytics', (req, res) => {
  res.json({
    totalSent: 1247,
    totalFailed: 23,
    successRate: 87.5,
    bounceRate: 2.3,
    dailyStats: { Mon: 120, Tue: 150, Wed: 180, Thu: 200, Fri: 170, Sat: 220, Sun: 190 }
  });
});

app.get('/api/logs', (req, res) => {
  res.json(emailLogs);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server immediately
app.listen(PORT, () => {
  console.log(`⚡ Fast server running on http://localhost:${PORT}`);
  console.log(`🚀 Dashboard ready instantly!`);
});
