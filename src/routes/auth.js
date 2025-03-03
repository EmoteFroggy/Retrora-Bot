const express = require('express');
const passport = require('passport');
const router = express.Router();

// Get the target channel name from environment variables
const TARGET_CHANNEL = process.env.CHANNEL_NAME 
  ? process.env.CHANNEL_NAME.replace(/^#/, '').toLowerCase() 
  : null;

console.log(`Auth routes initialized with target channel: ${TARGET_CHANNEL}`);

// Frontend URL for redirects
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://emotefroggy.github.io/Retrora-Bot';

// Twitch authentication route with explicit return_to parameter
router.get('/twitch', (req, res, next) => {
  // Force the return URL to be the root of the GitHub Pages site
  req.session.returnTo = FRONTEND_URL;
  next();
}, passport.authenticate('twitch'));

// Twitch callback route
router.get('/twitch/callback', 
  passport.authenticate('twitch', { failureRedirect: '/login' }),
  (req, res) => {
    // After successful authentication, redirect to GitHub Pages root
    // Do not add any query parameters
    console.log(`Authentication successful, redirecting to: ${FRONTEND_URL}`);
    res.redirect(FRONTEND_URL);
  }
);

// Check if user is authenticated
router.get('/status', (req, res) => {
  // Set proper CORS headers for this specific endpoint
  res.header('Access-Control-Allow-Origin', FRONTEND_URL);
  res.header('Access-Control-Allow-Credentials', 'true');
  
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

// Logout route
router.get('/logout', (req, res) => {
  // Set proper CORS headers
  res.header('Access-Control-Allow-Origin', FRONTEND_URL);
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Perform logout
  req.logout(function(err) {
    if (err) { return next(err); }
    // Redirect to GitHub Pages after logout
    console.log(`Logout successful, redirecting to: ${FRONTEND_URL}`);
    res.redirect(FRONTEND_URL);
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

// Export the router and middleware
module.exports = router;
module.exports.isAuthenticated = isAuthenticated;
module.exports.isModeratorOf = isModeratorOf; 