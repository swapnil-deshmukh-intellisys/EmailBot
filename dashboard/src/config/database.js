const mongoose = require('mongoose');

async function connectMongo(mongoUri) {
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
}

function getDbHealth() {
  const stateMap = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = mongoose.connection.readyState;
  return {
    ok: state === 1,
    state,
    status: stateMap[state] || 'unknown'
  };
}

module.exports = {
  connectMongo,
  getDbHealth
};
