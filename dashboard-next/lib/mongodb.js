import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not set');
}

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}
let schedulerInitPromise = global.__schedulerInitPromise || null;
global.__schedulerInitPromise = schedulerInitPromise;

async function ensureSchedulerInitialized() {
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
  if (cached.conn) {
    await ensureSchedulerInitialized();
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000
    });
  }

  cached.conn = await cached.promise;
  await ensureSchedulerInitialized();
  return cached.conn;
}
