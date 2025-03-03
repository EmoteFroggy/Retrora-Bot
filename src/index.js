require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

// Import routes later
const authRoutes = require('./routes/auth');
const commandRoutes = require('./routes/commands');

// Import bot configuration
const TwitchBot = require('./bot/bot');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

// Passport configuration
require('./config/passport');

// CORS configuration - Allow requests from GitHub Pages and development
const allowedOrigins = [
  'https://emotefroggy.github.io',  // Root GitHub Pages domain without trailing slash
  'https://emotefroggy.github.io/Retrora-Bot',  // Your GitHub Pages URL without trailing slash
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500',  // Common Live Server port
  process.env.CLIENT_URL    // Dynamic client URL from environment variable
].filter(Boolean); // Remove any undefined/empty entries

// Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (req.query && Object.keys(req.query).length > 0) {
    console.log('Query params:', req.query);
  }
  next();
});

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log(`CORS request from origin: ${origin}`);
      console.log(`Allowed origins: ${JSON.stringify(allowedOrigins)}`);
      
      // For security, don't tell the client why the request was rejected
      const corsError = new Error('CORS not allowed');
      return callback(corsError, false);
    }
    
    // Origin is allowed
    console.log(`CORS allowed for origin: ${origin}`);
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup dynamic callback URL based on environment if needed
if (process.env.NODE_ENV === 'production') {
  // Add middleware to detect the host
  app.use((req, res, next) => {
    // Store the host information for debugging
    if (req.headers.host) {
      console.log(`Request received with host: ${req.headers.host}`);
      console.log(`X-Forwarded-Proto: ${req.headers['x-forwarded-proto'] || 'not set'}`);
    }
    next();
  });
  
  // Log the current callback URL configuration
  console.log(`Current TWITCH_CALLBACK_URL: ${process.env.TWITCH_CALLBACK_URL}`);
  console.log(`Current NODE_ENV: ${process.env.NODE_ENV}`);
}

// Express session with MongoDB store
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'twitch-bot-secret',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGODB_URI 
    ? MongoStore.create({ 
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600 // Only update the session once per day (in seconds)
      }) 
    : null,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
};

// In production environment, ensure secure cookie is used with sameSite none
if (process.env.NODE_ENV === 'production') {
  sessionConfig.cookie.secure = true;
  sessionConfig.cookie.sameSite = 'none';
  console.log('Session configured for production with secure cookies');
}

app.use(session(sessionConfig));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Log middleware for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/api/commands', commandRoutes);

// Serve static files in development
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../public')));
}

// Simple status route
app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'online', 
    user: req.user || null,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Dashboard route - should redirect to GitHub Pages frontend with authenticated user info
app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/?error=authentication_required');
  }
  
  if (process.env.NODE_ENV === 'production') {
    // In production, redirect to the GitHub Pages frontend with auth token
    return res.redirect(`https://emotefroggy.github.io/Retrora-Bot/dashboard.html?userId=${req.user.id}`);
  }
  
  // In development, serve the dashboard from public folder
  res.sendFile(path.join(__dirname, '../public', 'dashboard.html'));
});

// Redirect the root to GitHub Pages in production
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.redirect('https://emotefroggy.github.io/Retrora-Bot/');
  }
  // In development, serve the index.html
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Catch-all route for SPA in development
app.get('*', (req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    return res.sendFile(path.join(__dirname, '../public', 'index.html'));
  }
  // In production, return a 404 for unknown routes
  res.status(404).send('Not found');
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