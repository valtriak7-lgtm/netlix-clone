// File purpose: Application logic for this Netflix Clone module.
const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.warn('MONGO_URI is missing in server/.env. Skipping database connection.');
    return;
  }
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
