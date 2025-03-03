const express = require('express');
const passport = require('passport');
const router = express.Router();

// Get the target channel name from environment variables
const TARGET_CHANNEL = process.env.CHANNEL_NAME 
  ? process.env.CHANNEL_NAME.replace(/^#/, '').toLowerCase() 
  : null;

console.log(`Auth routes initialized with target channel: ${TARGET_CHANNEL}`);
console.log(`Using Twitch callback URL: ${process.env.TWITCH_CALLBACK_URL}`);

// Twitch authentication route - simplified version
router.get('/twitch', (req, res, next) => {
  console.log('Starting Twitch authentication (simplified)');
  
  // Simple authentication with no extra options
  passport.authenticate('twitch')(req, res, next);
});

// Simplified callback route with direct approach
router.get('/twitch/callback', 
  passport.authenticate('twitch', { 
    failureRedirect: '/?error=auth_failed'
  }),
  (req, res) => {
    // At this point authentication succeeded
    console.log('Authentication successful via simplified flow');
    console.log('User:', req.user ? `${req.user.displayName} (${req.user.id})` : 'No user object');
    
    // Handle successful authentication
    if (process.env.NODE_ENV === 'production') {
      // Send to GitHub Pages with query parameters containing necessary info
      const redirectURL = `https://emotefroggy.github.io/Retrora-Bot/dashboard.html?loggedIn=true&userId=${req.user.id}`;
      console.log('Redirecting to:', redirectURL);
      return res.redirect(redirectURL);
    } else {
      // Local development
      return res.redirect('/dashboard');
    }
  }
);

// Check if user is authenticated
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    console.log('User authenticated:', req.user.displayName);
    console.log('Moderated channels:', req.user.moderatedChannels || []);
    console.log('Target channel:', TARGET_CHANNEL);
    console.log('isAdmin:', req.user.isAdmin);
    
    // User has access if they're admin or have the target channel in moderated channels
    const hasAccess = req.user.isAdmin || 
                     (req.user.moderatedChannels && 
                      req.user.moderatedChannels.includes(TARGET_CHANNEL));
    
    console.log(`User ${req.user.displayName} has access: ${hasAccess}`);
    
    res.json({
      isAuthenticated: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        profileImage: req.user.profileImage,
        moderatedChannels: hasAccess ? [TARGET_CHANNEL] : [],
        isAdmin: req.user.isAdmin
      }
    });
  } else {
    console.log('User not authenticated');
    res.json({ isAuthenticated: false });
  }
});

// Handle authentication errors for the frontend
router.get('/error', (req, res) => {
  const error = req.query.error || 'Unknown error';
  const description = req.query.error_description || 'An error occurred during authentication';
  
  console.error(`Auth error: ${error} - ${description}`);
  
  res.json({
    success: false,
    error,
    description
  });
});

// Debug route (REMOVE IN PRODUCTION!)
router.get('/debug', (req, res) => {
  // Only enable in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  res.json({
    environment: process.env.NODE_ENV,
    twitch: {
      callbackUrl: process.env.TWITCH_CALLBACK_URL,
      clientId: process.env.TWITCH_CLIENT_ID ? '✓ Set' : '✗ Not set',
      clientSecret: process.env.TWITCH_CLIENT_SECRET ? '✓ Set' : '✗ Not set',
      channelName: process.env.CHANNEL_NAME || 'Not set'
    },
    server: {
      host: req.headers.host,
      protocol: req.protocol,
      originalUrl: req.originalUrl
    }
  });
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized - Please log in' });
};

// Middleware to check if user is a moderator of the target channel
const isModeratorOf = (channelName) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized - Please log in' });
    }
    
    // For single channel app, only check against the target channel
    const normalizedRequestedChannel = channelName.replace(/^#/, '').toLowerCase();
    
    // Only allow access if requested channel matches TARGET_CHANNEL AND user has access
    const isRequestingTargetChannel = normalizedRequestedChannel === TARGET_CHANNEL;
    
    // User has access if they're admin or have the target channel in moderated channels
    const hasAccess = req.user.isAdmin || 
                     (req.user.moderatedChannels && 
                      req.user.moderatedChannels.includes(TARGET_CHANNEL));
    
    console.log(`Channel access check for ${req.user.displayName}:`);
    console.log(`- Requested channel: ${normalizedRequestedChannel}`);
    console.log(`- Target channel: ${TARGET_CHANNEL}`);
    console.log(`- Is admin: ${req.user.isAdmin}`);
    console.log(`- Moderated channels: ${req.user.moderatedChannels?.join(', ') || 'none'}`);
    console.log(`- Has access: ${hasAccess}`);
    
    if (isRequestingTargetChannel && hasAccess) {
      console.log(`Access granted for ${req.user.displayName} to ${channelName}`);
      return next();
    }
    
    console.log(`Access denied for ${req.user.displayName} to ${channelName}`);
    return res.status(403).json({ 
      error: 'Forbidden - You do not have permission to manage commands for this channel' 
    });
  };
};

// User data endpoint for GitHub Pages frontend
router.get('/user/:id', (req, res) => {
  console.log('Getting user data by ID:', req.params.id);
  
  // For a production app, you would retrieve this from your database
  // But for our simplified flow, we'll create a mock user
  const userData = {
    id: req.params.id,
    displayName: 'Twitch User',
    profileImage: 'https://static-cdn.jtvnw.net/user-default-pictures-uv/ebe4cd89-b4f4-4cd9-adac-2f30151b4209-profile_image-300x300.png',
    moderatedChannels: [process.env.CHANNEL_NAME.toLowerCase()],
    isAdmin: true // Assuming they're authenticated, they're allowed access
  };
  
  return res.json(userData);
});

// Export the router and middleware
module.exports = router;
module.exports.isAuthenticated = isAuthenticated;
module.exports.isModeratorOf = isModeratorOf; 