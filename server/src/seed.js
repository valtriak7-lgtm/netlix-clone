// File purpose: Application logic for this Netflix Clone module.
require('dotenv').config();
const connectDB = require('./config/db');
const Movie = require('./models/Movie');
const seedMovies = require('./data/seedMovies');

async function runSeed() {
  try {
    await connectDB();
    await Movie.deleteMany({});
    await Movie.insertMany(seedMovies);
    console.log(`Seeded ${seedMovies.length} movies`);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }
}

runSeed();
