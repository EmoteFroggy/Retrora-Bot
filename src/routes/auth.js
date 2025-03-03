const express = require('express');
const passport = require('passport');
const router = express.Router();

// Get the target channel name from environment variables
const TARGET_CHANNEL = process.env.CHANNEL_NAME 
  ? process.env.CHANNEL_NAME.replace(/^#/, '').toLowerCase() 
  : null;

console.log(`Auth routes initialized with target channel: ${TARGET_CHANNEL}`);
console.log(`Using Twitch callback URL: ${process.env.TWITCH_CALLBACK_URL}`);

// Twitch authentication route
router.get('/twitch', (req, res, next) => {
  console.log('Initiating Twitch authentication...');
  console.log('Callback URL:', process.env.TWITCH_CALLBACK_URL);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Client ID (truncated):', process.env.TWITCH_CLIENT_ID ? `${process.env.TWITCH_CLIENT_ID.substring(0, 5)}...` : 'Not set');
  
  // Reset any existing authentication state to ensure a fresh session
  if (req.session) {
    if (req.session.passport) {
      delete req.session.passport;
    }
    req.session.authAttempt = Date.now();
  }
  
  // Force login to ensure a fresh authorization code
  passport.authenticate('twitch', { 
    forceVerify: true,  // Force Twitch to re-verify the user
    session: true       // Ensure session is used
  })(req, res, next);
});

// Twitch callback route with detailed error handling
router.get('/twitch/callback', (req, res, next) => {
  // Check for error parameters from Twitch OAuth
  if (req.query.error) {
    console.error('OAuth error from Twitch:', req.query.error);
    console.error('Error description:', req.query.error_description);
    
    // For redirect_uri mismatch errors, log additional helpful information
    if (req.query.error === 'redirect_mismatch') {
      console.error('REDIRECT_URI MISMATCH ERROR:');
      console.error('Current callback URL:', process.env.TWITCH_CALLBACK_URL);
      console.error('Make sure this exact URL is registered in your Twitch Developer Console');
      console.error('Request host:', req.headers.host);
      console.error('Request URL:', req.url);
      console.error('Request protocol:', req.protocol);
    }
    
    return res.redirect(`/?error=${encodeURIComponent(req.query.error)}&error_description=${encodeURIComponent(req.query.error_description)}`);
  }
  
  // If no error in query params, proceed with authentication
  passport.authenticate('twitch', function(err, user, info) {
    if (err) {
      console.error('Authentication error:', err);
      
      // Check for token exchange errors
      if (err.name === 'InternalOAuthError') {
        console.error('OAuth Token Exchange Error. Check your Twitch client ID and secret.');
        console.error('Original error:', err.message);
        if (err.oauthError) {
          console.error('OAuth error details:', err.oauthError);
        }
        return res.redirect('/?error=oauth_token_exchange&error_description=Failed+to+obtain+access+token');
      }
      
      return res.redirect(`/?error=${encodeURIComponent(err.name || 'unknown')}&error_description=${encodeURIComponent(err.message || 'Unknown error')}`);
    }
    
    if (!user) {
      console.error('No user returned from authentication');
      return res.redirect('/?error=authentication_failed&error_description=User+not+found');
    }
    
    req.logIn(user, function(loginErr) {
      if (loginErr) {
        console.error('Login error:', loginErr);
        return res.redirect('/?error=login_failed&error_description=Error+during+login+process');
      }
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

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

// Export the router and middleware
module.exports = router;
module.exports.isAuthenticated = isAuthenticated;
module.exports.isModeratorOf = isModeratorOf; 