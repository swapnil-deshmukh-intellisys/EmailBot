import mongoose from 'mongoose';

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}
let schedulerInitPromise = global.__schedulerInitPromise || null;
global.__schedulerInitPromise = schedulerInitPromise;

function shouldAutoStartCampaignScheduler() {
  const configured = String(process.env.ENABLE_IN_APP_CAMPAIGN_SCHEDULER || '').trim().toLowerCase();
  if (configured === 'true') return true;
  if (configured === 'false') return false;
  return process.env.NODE_ENV !== 'production';
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
    const { initCampaignScheduler } = await import('./campaignScheduler');
    initCampaignScheduler();
  })();
  global.__schedulerInitPromise = schedulerInitPromise;
  await schedulerInitPromise;
}

export default async function connectDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  if (cached.conn) {
    await ensureSchedulerInitialized();
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
  return cached.conn;
}
