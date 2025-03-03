require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const axios = require('axios');

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
  
  // Access-Control-Allow-Credentials must be set before any CORS response
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
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
  credentials: true,          // Allow cookies to be sent with requests
  exposedHeaders: ['Set-Cookie'],  // Expose the Set-Cookie header
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cookie']
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

// API endpoint to check authentication status
app.get('/api/user', (req, res) => {
  // Add appropriate CORS headers for credential sharing
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.isAuthenticated() && req.user) {
    // User is authenticated, return user data
    const userData = {
      authenticated: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        twitchId: req.user.twitchId,
        moderatedChannels: req.user.moderatedChannels || [],
        isAdmin: req.user.isAdmin
      }
    };
    
    console.log('Returning authenticated user data:', userData);
    return res.json(userData);
  } else {
    // User is not authenticated
    console.log('User not authenticated, session:', !!req.session);
    return res.json({ 
      authenticated: false,
      message: 'Not authenticated'
    });
  }
});

// User data API endpoint (for GitHub Pages frontend)
app.get('/api/user/:id', async (req, res) => {
  console.log('API - Get user data by ID:', req.params.id);
  
  try {
    const userId = req.params.id;
    
    // Get an app access token to make API calls
    const tokenResponse = await axios.post(
      'https://id.twitch.tv/oauth2/token',
      new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const appAccessToken = tokenResponse.data.access_token;
    console.log('Obtained app access token for API calls');
    
    // Get user information from Twitch API
    const userResponse = await axios.get(
      `https://api.twitch.tv/helix/users?id=${userId}`,
      {
        headers: {
          'Authorization': `Bearer ${appAccessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID
        }
      }
    );
    
    if (!userResponse.data.data || userResponse.data.data.length === 0) {
      console.error('No user data found for ID:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const twitchUser = userResponse.data.data[0];
    console.log('Retrieved user data from Twitch:', twitchUser.display_name);
    
    // Create user object with Twitch data
    const userData = {
      id: userId,
      displayName: twitchUser.display_name,
      login: twitchUser.login,
      profileImage: twitchUser.profile_image_url,
      moderatedChannels: [process.env.CHANNEL_NAME.toLowerCase()],
      isAdmin: true // Assuming they're authenticated, they're allowed access
    };
    
    return res.json(userData);
  } catch (error) {
    console.error('Error fetching user data from Twitch:', error);
    
    // Return a fallback user if we can't get the real data
    const fallbackUser = {
      id: req.params.id,
      displayName: 'Twitch User',
      profileImage: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-300x300.png',
      moderatedChannels: [process.env.CHANNEL_NAME.toLowerCase()],
      isAdmin: true
    };
    
    console.log('Returning fallback user data');
    return res.json(fallbackUser);
  }
});

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

// Commands API endpoints (for GitHub Pages frontend)
// Get commands for a channel
app.get('/api/commands/:channel', (req, res) => {
  console.log('API - Get commands for channel:', req.params.channel);
  
  // Check for user authentication via query parameter
  const userId = req.query.userId;
  if (!userId) {
    console.log('No userId provided in query params');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  console.log('Request authenticated via userId:', userId);
  
  // For a production app, you would retrieve this from your database
  // But for our simplified flow, we'll return dummy commands
  const dummyCommands = [
    {
      _id: '1',
      name: 'hello',
      response: 'Hello, world!',
      cooldown: 5,
      userLevel: 'everyone',
      enabled: true
    },
    {
      _id: '2',
      name: 'discord',
      response: 'Join our Discord server at https://discord.gg/example',
      cooldown: 30,
      userLevel: 'everyone',
      enabled: true
    },
    {
      _id: '3',
      name: 'uptime',
      response: 'Stream has been live for X hours',
      cooldown: 15,
      userLevel: 'moderator',
      enabled: true
    }
  ];
  
  return res.json(dummyCommands);
});

// Create a new command
app.post('/api/commands/:channel', express.json(), (req, res) => {
  console.log('API - Create command for channel:', req.params.channel);
  
  // Check for user authentication via query parameter
  const userId = req.query.userId;
  if (!userId) {
    console.log('No userId provided in query params');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  console.log('Request authenticated via userId:', userId);
  console.log('Command data:', req.body);
  
  // In a real app, you would save this to the database
  // For now, just return success with a mock ID
  const newCommand = {
    ...req.body,
    _id: Date.now().toString(),
    enabled: true
  };
  
  return res.status(201).json(newCommand);
});

// Update a command
app.put('/api/commands/:channel/:commandId', express.json(), (req, res) => {
  console.log('API - Update command:', req.params.commandId, 'for channel:', req.params.channel);
  
  // Check for user authentication via query parameter
  const userId = req.query.userId;
  if (!userId) {
    console.log('No userId provided in query params');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  console.log('Request authenticated via userId:', userId);
  console.log('Updated data:', req.body);
  
  // In a real app, you would update this in the database
  // For now, just return success
  const updatedCommand = {
    ...req.body,
    _id: req.params.commandId,
    enabled: true
  };
  
  return res.json(updatedCommand);
});

// Delete a command
app.delete('/api/commands/:channel/:commandId', (req, res) => {
  console.log('API - Delete command:', req.params.commandId, 'for channel:', req.params.channel);
  
  // Check for user authentication via query parameter
  const userId = req.query.userId;
  if (!userId) {
    console.log('No userId provided in query params');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  console.log('Request authenticated via userId:', userId);
  
  // In a real app, you would delete this from the database
  // For now, just return success
  return res.json({ success: true, message: 'Command deleted' });
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