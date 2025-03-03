require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const path = require('path');

// Import database connection
const { connectToDatabase, mongoose } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const commandRoutes = require('./routes/commands');

// Import bot configuration
const TwitchBot = require('./bot/bot');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectToDatabase();

// Passport configuration
require('./config/passport');

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'twitch-bot-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'native',
    touchAfter: 24 * 3600, // time period in seconds
    crypto: {
      secret: process.env.SESSION_SECRET || 'twitch-bot-secret'
    },
    // Added these options for better resilience
    clientPromise: null, // Let connect-mongo create its own connection
    stringify: false, // Don't stringify session data (more efficient)
    connectionOptions: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000
    },
    // Better error handling
    handleReconnectFailed: function() {
      console.error('Failed to reconnect to MongoDB session store after multiple attempts');
    }
  }),
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    httpOnly: true
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/auth', authRoutes);
app.use('/api/commands', commandRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Simple status route
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online', 
    user: req.user || null,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Explicit route for dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Start the server if not in serverless environment
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export for serverless
module.exports = app;

// Initialize the Twitch bot if configured
if (process.env.BOT_USERNAME && process.env.BOT_TOKEN && process.env.CHANNEL_NAME) {
  // Make sure channel name is properly formatted (should have # prefix for tmi.js)
  const channelName = process.env.CHANNEL_NAME.startsWith('#') 
    ? process.env.CHANNEL_NAME 
    : `#${process.env.CHANNEL_NAME}`;
    
  console.log(`Initializing bot for channel: ${channelName}`);
  
  const bot = new TwitchBot({
    username: process.env.BOT_USERNAME,
    token: process.env.BOT_TOKEN,
    channel: channelName
  });
  
  // Set the global bot instance for command management
  global.bot = bot;
  
  // Connect the bot
  bot.connect();
} 