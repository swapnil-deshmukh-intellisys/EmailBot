const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    // Query collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:');
    collections.forEach(c => console.log(` - ${c.name}`));

    // Check email drafts count
    const count = await mongoose.connection.db.collection('emaildrafts').countDocuments();
    console.log(`\nTotal drafts in emaildrafts collection: ${count}`);

    // Fetch a sample draft
    const sample = await mongoose.connection.db.collection('emaildrafts').findOne({});
    console.log('\nSample draft:', JSON.stringify(sample, null, 2));

    await mongoose.disconnect();
    console.log('\nDisconnected successfully.');
  } catch (err) {
    console.error('Connection failed:', err);
    process.exit(1);
  }
}

testConnection();
