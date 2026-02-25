require('dotenv').config();
const dns = require('dns');
const app = require('./app');
const connectDB = require('./config/db');

const port = Number(process.env.PORT || 5000);

dns.setDefaultResultOrder('ipv4first');

async function startServer() {
  try {
    try {
      await connectDB();
    } catch (error) {
      if (process.env.TMDB_API_KEY) {
        console.warn('MongoDB connection failed. Continuing with TMDB only.');
      } else {
        throw error;
      }
    }
    app.listen(port, () => {
      console.log(`Server listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
