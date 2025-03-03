require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const commandRoutes = require('./routes/commands');

// Import bot configuration
const TwitchBot = require('./bot/bot');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://emotefroggy.github.io/Retrora-Bot';
const BACKEND_URL = process.env.BACKEND_URL || 'https://retrora-bot.vercel.app';

console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
console.log(`Frontend URL: ${FRONTEND_URL}`);
console.log(`Backend URL: ${BACKEND_URL}`);

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
} else {
  console.warn('No MongoDB URI provided, database functionality will not work');
}

// Passport configuration
require('./config/passport');

// CORS configuration for production
app.use(cors({
  origin: [FRONTEND_URL, BACKEND_URL, 'https://emotefroggy.github.io'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'twitch-bot-secret',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGODB_URI 
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI }) 
    : null,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    domain: isProduction ? '.vercel.app' : undefined
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
    environment: isProduction ? 'production' : 'development',
    serverTime: new Date().toISOString()
  });
});

// CORS preflight for complex requests
app.options('*', cors());

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Start the server if not in serverless environment
if (!isProduction) {
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