const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { connectMongo } = require('./config/database');
const { PUBLIC_DIR, UPLOADS_DIR, DATA_DIR } = require('./config/paths');

const authRoutes = require('./routes/authRoutes');
const campaignRoutes = require('./routes/campaignRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const healthRoutes = require('./routes/healthRoutes');
const leadRoutes = require('./routes/leadRoutes');
const logRoutes = require('./routes/logRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');

function createApp() {
  const app = express();

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(express.static(PUBLIC_DIR, { maxAge: '1d', etag: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/campaigns', campaignRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api', leadRoutes); // includes /api/upload-leads
  app.use('/api/logs', logRoutes);
  app.use('/api', realtimeRoutes);

  app.get('/', (req, res) => {
    res.sendFile(`${PUBLIC_DIR}/index.html`);
  });

  app.get('/monitor', (req, res) => {
    res.sendFile(`${PUBLIC_DIR}/realtime-monitor.html`);
  });

  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function initDependencies() {
  await connectMongo(process.env.MONGODB_URI);
}

module.exports = {
  createApp,
  initDependencies
};
