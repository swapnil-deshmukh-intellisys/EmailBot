const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const uploadDir = path.resolve(__dirname, 'uploads');
const dataDir = path.resolve(__dirname, '..', 'data');

// Ensure runtime directories exist for multer/temp files and uploaded leads.
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

// Enable CORS for all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));

// MongoDB connection (Atlas/local URI via MONGODB_URI)
const mongoUri = process.env.MONGODB_URI;

const connectMongo = async () => {
  if (!mongoUri) {
    console.warn('MONGODB_URI is not set. Running without database connection.');
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      bufferCommands: false
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.warn('Server will continue without database-backed persistence.');
  }
};

connectMongo();
// Simple in-memory storage for demo (faster startup)
let campaigns = [
  { id: 1, name: 'AI Leadership Campaign', status: 'Active', sendLimit: 2000, delayBetweenEmails: 60 },
  { id: 2, name: 'Robotics Innovation', status: 'Draft', sendLimit: 1500, delayBetweenEmails: 45 },
  { id: 3, name: 'Tech Summit 2026', status: 'Paused', sendLimit: 3000, delayBetweenEmails: 30 }
];

let emailLogs = [
  { email: 'john@example.com', status: 'Sent', time: '2026-03-02 14:52:00', responseCode: '200' },
  { email: 'jane@company.com', status: 'Failed', time: '2026-03-02 14:53:00', responseCode: '550' },
  { email: 'mike@startup.io', status: 'Rate Limited', time: '2026-03-02 14:54:00', responseCode: '429' },
  { email: 'sarah@tech.com', status: 'Sent', time: '2026-03-02 14:55:00', responseCode: '200' },
  { email: 'alex@ai.com', status: 'Sent', time: '2026-03-02 14:56:00', responseCode: '200' },
  { email: 'lisa@robotics.com', status: 'Blocked', time: '2026-03-02 14:57:00', responseCode: '554' }
];

// Auth middleware (simplified for demo)
const authenticateToken = (req, res, next) => {
  // For this demo we don't enforce tokens; any request is treated as Admin
  req.user = { userId: 'demo-user', role: 'Admin' };
  next();
};

// configure multer for file uploads (leads spreadsheet)
const upload = multer({ dest: uploadDir });


// Routes
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Demo login - accept any credentials
  const token = jwt.sign(
    { userId: 'demo-user', role: 'Admin' }, 
    process.env.JWT_SECRET || 'demo-secret',
    { expiresIn: '24h' }
  );
  
  res.json({ 
    token, 
    user: { username: username || 'Admin', role: 'Admin' } 
  });
});

app.get('/api/campaigns', authenticateToken, (req, res) => {
  res.json(campaigns);
});

app.post('/api/campaigns', authenticateToken, (req, res) => {
  const campaign = {
    id: campaigns.length + 1,
    ...req.body,
    createdBy: req.user.userId
  };
  campaigns.push(campaign);
  res.json(campaign);
});

app.get('/api/analytics', authenticateToken, (req, res) => {
  const stats = {
    totalSent: 1247,
    totalFailed: 23,
    successRate: 87.5,
    bounceRate: 2.3,
    dailyStats: {
      'Mon': 120,
      'Tue': 150,
      'Wed': 180,
      'Thu': 200,
      'Fri': 170,
      'Sat': 220,
      'Sun': 190
    }
  };
  
  res.json(stats);
});

app.get('/api/health/db', (req, res) => {
  const stateMap = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = mongoose.connection.readyState;
  res.json({
    ok: state === 1,
    state,
    status: stateMap[state] || 'unknown'
  });
});

// return leads from the spreadsheet (calls Python helper)
app.get('/api/leads', authenticateToken, (req, res) => {
  const pythonCmd = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(__dirname, '..', 'daily_campaign.py');

  const child = spawn(pythonCmd, [scriptPath, '--dump'], { shell: false });
  let stdout = '';
  let stderr = '';
  let spawnError = null;

  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', (err) => { spawnError = err; });

  child.on('close', (code) => {
    if (stderr) console.error('leads dump stderr:', stderr);
    if (spawnError || code !== 0) {
      return res.status(200).json({
        success: false,
        leads: [],
        error: spawnError ? spawnError.message : (stderr || `daily_campaign exited with code ${code}`)
      });
    }

    try {
      const leads = JSON.parse(stdout);
      res.json({ success: code === 0, leads });
    } catch (e) {
      res.status(200).json({
        success: false,
        leads: [],
        error: 'Failed to parse leads output',
        raw: stdout,
        code
      });
    }
  });
});

// upload a new leads file (xlsx)
app.post('/api/upload-leads', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const dest = path.resolve(dataDir, 'clients_new.xlsx');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.rename(req.file.path, dest, (err) => {
    if (err) {
      // Handle cross-device move errors by falling back to copy + delete.
      if (err.code === 'EXDEV') {
        fs.copyFile(req.file.path, dest, (copyErr) => {
          if (copyErr) {
            console.error('upload copy error', copyErr);
            return res.status(500).json({ error: 'Failed to save file' });
          }
          fs.unlink(req.file.path, () => {
            res.json({ success: true, message: 'Leads file uploaded', path: dest });
          });
        });
        return;
      }
      console.error('upload error', err);
      return res.status(500).json({ error: 'Failed to save file' });
    }
    res.json({ success: true, message: 'Leads file uploaded', path: dest });
  });
});

app.get('/api/logs', authenticateToken, (req, res) => {
  res.json(emailLogs);
});

app.post('/api/send-emails', authenticateToken, (req, res) => {
  const { campaignId, emails } = req.body;
  
  // Simulate email sending
  res.json({ 
    message: 'Email sending started', 
    campaignId,
    estimatedTime: emails.length * 60 // 60 seconds per email
  });
});

// Real-time email sending state
let emailSendingState = {
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
};

// WebSocket-like event broadcasting
const broadcastEvent = (type, data) => {
  // Store events for polling
  emailSendingState.logs.push({
    type,
    message: data.message,
    email: data.email,
    timestamp: new Date().toLocaleTimeString()
  });
  
  // Keep only last 100 logs
  if (emailSendingState.logs.length > 100) {
    emailSendingState.logs = emailSendingState.logs.slice(-100);
  }
};

// Real email sending function
const sendRealEmails = async () => {
  try {
    // Import the real email sender
    const { sendRealEmails, setUpdateCallback } = require('./email_bot_real');
    
    // Set up real-time updates callback
    setUpdateCallback((type, message, email) => {
      broadcastEvent(type, { message, email });
      
      // Update current email being sent
      if (type === 'sending') {
        emailSendingState.currentEmail = email;
      } else if (type === 'waiting') {
        emailSendingState.currentEmail = null;
      } else if (type === 'success' && email) {
        emailSendingState.currentEmail = null;
        emailSendingState.stats.totalSent++;
      } else if (type === 'failed' && email) {
        emailSendingState.currentEmail = null;
        emailSendingState.stats.totalFailed++;
      }
    });
    
    emailSendingState.isRunning = true;
    broadcastEvent('info', { message: 'Starting email campaign from clients_new.xlsx...' });
    
    // Start the real email sending process
    const results = await sendRealEmails();
    
    // Final stats update
    emailSendingState.stats.totalSent = results.filter(r => r.success).length;
    emailSendingState.stats.totalFailed = results.filter(r => !r.success).length;
    emailSendingState.stats.totalRemaining = 0;
    
    emailSendingState.currentEmail = null;
    emailSendingState.isRunning = false;
    
  } catch (error) {
    emailSendingState.isRunning = false;
    emailSendingState.currentEmail = null;
    broadcastEvent('error', { message: `Campaign error: ${error.message}` });
  }
};

// API Routes for real-time monitoring
app.post('/api/start-campaign', (req, res) => {
  if (emailSendingState.isRunning) {
    return res.status(400).json({ error: 'Campaign already running' });
  }
  
  // Reset state
  emailSendingState.stats = {
    totalSent: 0,
    totalFailed: 0,
    totalRemaining: 0,
    currentBatch: 0,
    sendingSpeed: 0
  };
  emailSendingState.logs = [];
  
  // Start sending in background
  sendRealEmails();
  
  res.json({ success: true, message: 'Campaign started' });
});

app.post('/api/stop-campaign', (req, res) => {
  emailSendingState.isRunning = false;
  emailSendingState.currentEmail = null;
  res.json({ success: true, message: 'Campaign stopped' });
});

app.post('/api/clear-logs', (req, res) => {
  emailSendingState.logs = [];
  emailSendingState.stats = {
    totalSent: 0,
    totalFailed: 0,
    totalRemaining: 0,
    currentBatch: 0,
    sendingSpeed: 0
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

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the real-time monitor
app.get('/monitor', (req, res) => {
  res.sendFile(__dirname + '/public/realtime-monitor.html');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server and automatically retry on the next port when current one is in use.
let server = null;
let activePort = Number(PORT) || 5000;

const startServer = () => {
  server = app.listen(activePort, () => {
    console.log(`🚀 Server running on port ${activePort}`);
    console.log(`📊 Dashboard: http://localhost:${activePort}`);
    console.log(`⚡ Ready for connections!`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${activePort} is in use. Retrying on ${activePort + 1}...`);
      activePort += 1;
      setTimeout(startServer, 200);
      return;
    }
    console.error('Server startup error:', err);
    process.exit(1);
  });
};

startServer();

// Graceful shutdown
const shutdown = () => {
  console.log('🔄 Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
    return;
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = app;

// Endpoint to trigger the Python daily campaign (admin action)
let pythonCampaignRunning = false;

app.post('/api/run-daily-campaign', authenticateToken, (req, res) => {
  if (pythonCampaignRunning) return res.status(400).json({ error: 'Daily campaign already running' });

  // For safety, require admin role in demo
  if (!req.user || req.user.role !== 'Admin') return res.status(403).json({ error: 'Admin role required' });

  pythonCampaignRunning = true;
  const pythonCmd = process.env.PYTHON_PATH || 'python';
  const scriptPath = path.resolve(__dirname, '..', 'daily_campaign.py');

  // Forward send flag if provided in request body (must be boolean true)
  const args = [scriptPath];
  if (req.body && req.body.send) args.push('--send');
  const child = spawn(pythonCmd, args, { shell: false });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  // Safety timeout (10 minutes) to avoid runaway process
  const timeout = setTimeout(() => {
    try { child.kill(); } catch (e) {}
  }, 10 * 60 * 1000);

  child.on('close', (code) => {
    clearTimeout(timeout);
    pythonCampaignRunning = false;

    if (stderr) console.error('daily_campaign stderr:', stderr);

    // Try to parse stdout as JSON summary
    let summary = null;
    try {
      // Extract last JSON-looking object from stdout
      const match = stdout.match(/\{[\s\S]*\}$/m);
      summary = match ? JSON.parse(match[0]) : JSON.parse(stdout);
    } catch (e) {
      // If parsing fails, return raw output
      return res.status(200).json({ success: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    }

    return res.status(200).json({ success: code === 0, code, summary });
  });
});

// 404 handler (must stay last so API routes defined below are reachable)
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

