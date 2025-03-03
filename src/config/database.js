const mongoose = require('mongoose');

// MongoDB connection options - optimized for Vercel serverless environment
const mongoOptions = {
  serverSelectionTimeoutMS: 30000, // Increased from 5000 to 30000
  socketTimeoutMS: 60000, // Increased from 45000 to 60000
  connectTimeoutMS: 30000, // Increased from 10000 to 30000
  maxPoolSize: 10,
  retryWrites: true,
  retryReads: true,
  useNewUrlParser: true,
  useUnifiedTopology: true
};

// Connect to MongoDB with improved error handling
async function connectToDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not provided in environment variables');
    console.error('Please set up your MongoDB connection string as described in MONGODB_SETUP.md');
    return null;
  }
  
  try {
    console.log('Connecting to MongoDB...');
    // Use a more resilient connection approach that retries automatically
    mongoose.set('strictQuery', false); // Suppress deprecation warning
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    
    console.log('Connected to MongoDB successfully');
    setupEventListeners();
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    
    // Enhanced error logging for connection issues
    if (error.name === 'MongooseServerSelectionError') {
      console.error('Could not connect to MongoDB server. Possible causes:');
      console.error('1. Network access is not configured correctly (check IP whitelist)');
      console.error('2. Database credentials are incorrect');
      console.error('3. MongoDB Atlas cluster is not running');
      console.error('See MONGODB_SETUP.md for detailed troubleshooting steps');
    }
    
    console.log('Will retry connection in background...');
    // Don't throw the error - let the app continue
    setupEventListeners();
    return null;
  }
}

// Setup MongoDB connection event listeners with improved handling
function setupEventListeners() {
  const connection = mongoose.connection;
  
  connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
    
    // Attempt to reconnect when appropriate
    if (err.name === 'MongoNetworkError') {
      console.log('Network error detected, MongoDB driver will retry automatically');
    }
  });
  
  connection.on('disconnected', () => {
    console.log('MongoDB disconnected - the driver will attempt to reconnect automatically');
  });
  
  connection.on('reconnected', () => {
    console.log('MongoDB reconnected successfully');
  });
  
  connection.on('reconnectFailed', () => {
    console.error('MongoDB reconnection failed after maximum attempts');
  });
  
  // Handle process termination
  process.on('SIGINT', async () => {
    try {
      await connection.close();
      console.log('MongoDB connection closed due to app termination');
    } catch (err) {
      console.error('Error closing MongoDB connection:', err);
    }
    process.exit(0);
  });
}

// Export the connection function and mongoose
module.exports = {
  connectToDatabase,
  mongoose
}; 