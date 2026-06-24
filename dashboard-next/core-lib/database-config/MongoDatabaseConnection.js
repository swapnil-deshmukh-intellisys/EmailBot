import mongoose from 'mongoose';

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}
let schedulerInitPromise = global.__schedulerInitPromise || null;
global.__schedulerInitPromise = schedulerInitPromise;
let warmupSchedulerInitPromise = global.__warmupSchedulerInitPromise || null;
global.__warmupSchedulerInitPromise = warmupSchedulerInitPromise;

function shouldAutoStartCampaignScheduler() {
  if (process.env.VERCEL) return false;
  const configured = String(process.env.ENABLE_IN_APP_CAMPAIGN_SCHEDULER || '').trim().toLowerCase();
  return configured === 'true';
}

function shouldAutoStartWarmupScheduler() {
  if (process.env.VERCEL) return false;
  const configured = String(process.env.ENABLE_IN_APP_WARMUP_SCHEDULER || '').trim().toLowerCase();
  return configured === 'true';
}

async function ensureSchedulerInitialized() {
  if (!shouldAutoStartCampaignScheduler()) {
    return;
  }
  if (schedulerInitPromise) {
    await schedulerInitPromise;
    return;
  }

  schedulerInitPromise = (async () => {
    const { initCampaignScheduler } = await import('../campaign-engine/CampaignQueueScheduler.js');
    initCampaignScheduler();
  })();
  global.__schedulerInitPromise = schedulerInitPromise;
  await schedulerInitPromise;
}

async function ensureWarmupSchedulerInitialized() {
  if (!shouldAutoStartWarmupScheduler()) {
    return;
  }
  if (warmupSchedulerInitPromise) {
    await warmupSchedulerInitPromise;
    return;
  }

  warmupSchedulerInitPromise = (async () => {
    const { initWarmupAutoCommunicationScheduler } = await import('../mail-engine/WarmupAutoCommunicationService.js');
    initWarmupAutoCommunicationScheduler();
  })();
  global.__warmupSchedulerInitPromise = warmupSchedulerInitPromise;
  await warmupSchedulerInitPromise;
}

export default async function connectDB() {
  const mongoUri = String(process.env.MONGODB_URI || '').trim();
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }
  if (mongoUri.includes('<') || mongoUri.includes('>')) {
    throw new Error(
      'MONGODB_URI contains placeholder tokens like <real_user>/<real_cluster>. Replace them with real Atlas credentials.'
    );
  }
  if (mongoUri.includes('username:password@cluster.mongodb.net')) {
    throw new Error(
      'MONGODB_URI is using the placeholder value from .env.example. Replace it with a real MongoDB connection string.'
    );
  }

  if (cached.conn) {
    await ensureSchedulerInitialized();
    await ensureWarmupSchedulerInitialized();
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    });
  }

  cached.conn = await cached.promise;
  await ensureSchedulerInitialized();
  await ensureWarmupSchedulerInitialized();
  return cached.conn;
}
