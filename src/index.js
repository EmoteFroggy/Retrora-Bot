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
  'https://REPLACE_WITH_YOUR_GITHUB_PAGES_URL',  // Replace with your GitHub Pages URL
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500'  // Common Live Server port
];

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      console.log(`CORS request from: ${origin}`);
      // If specific origins are required, you can block here
      // const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      // return callback(new Error(msg), false);
      
      // Or allow any origin in development
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with secure settings for production
app.use(session({
  secret: process.env.SESSION_SECRET || 'twitch-bot-secret',
  resave: false,
  saveUninitialized: false,
  store: process.env.MONGODB_URI 
    ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI }) 
    : null,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

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

// Redirect the root to GitHub Pages in production
app.get('/', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.redirect('https://REPLACE_WITH_YOUR_GITHUB_PAGES_URL');
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