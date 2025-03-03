const passport = require('passport');
const TwitchStrategy = require('passport-twitch-new').Strategy;
const mongoose = require('mongoose');
const User = require('../models/user');
const axios = require('axios');

// Log environment information at startup for debugging
console.log('Passport configuration loading...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('TWITCH_CALLBACK_URL:', process.env.TWITCH_CALLBACK_URL);
console.log('TWITCH_CLIENT_ID is set:', !!process.env.TWITCH_CLIENT_ID);
console.log('TWITCH_CLIENT_SECRET is set:', !!process.env.TWITCH_CLIENT_SECRET);

// Serialize user to session
passport.serializeUser((user, done) => {
  console.log('Serializing user:', user.id);
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  console.log('Deserializing user:', id);
  // Since we're not using a database in this simplified flow,
  // we can't retrieve the full user. Instead, we'll return a partial user object.
  // The actual user data will need to be passed via query parameters to the frontend.
  done(null, { id: id });
});

// Get Twitch user ID from username
async function getTwitchUserId(username, accessToken) {
  try {
    console.log(`Getting Twitch user ID for: ${username}`);
    const response = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      console.log(`Found user ID for ${username}: ${response.data.data[0].id}`);
      return response.data.data[0].id;
    }
    console.log(`No user ID found for ${username}`);
    return null;
  } catch (error) {
    console.error('Error getting Twitch user ID:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return null;
  }
}

// Check if user is a moderator (or broadcaster) of the target channel
async function checkModeratorStatus(accessToken, userId, profile) {
  try {
    // Get the target channel name
    const targetChannelName = process.env.CHANNEL_NAME || '';
    
    if (!targetChannelName) {
      console.warn('No target channel specified in environment variables');
      return false;
    }
    
    // Normalize channel name
    const normalizedTargetChannel = targetChannelName.replace(/^#/, '').toLowerCase();
    
    console.log(`Checking if user ${profile.display_name} (ID: ${profile.id}) is a moderator of channel: ${normalizedTargetChannel}`);
    
    // If user is the channel owner/broadcaster, they have permission
    if (profile.login.toLowerCase() === normalizedTargetChannel.toLowerCase()) {
      console.log(`User ${profile.display_name} is the broadcaster - automatic permission granted`);
      return true;
    }
    
    // Get channel/broadcaster ID
    const broadcasterId = await getTwitchUserId(normalizedTargetChannel, accessToken);
    
    if (!broadcasterId) {
      console.error(`Could not find broadcaster ID for channel: ${normalizedTargetChannel}`);
      return false;
    }
    
    console.log(`Got broadcaster ID: ${broadcasterId} for channel: ${normalizedTargetChannel}`);
    
    // Check if user is a moderator using the correct Helix API endpoint
    console.log(`Checking moderation status with endpoint: /helix/moderation/moderators`);
    const response = await axios.get(`https://api.twitch.tv/helix/moderation/moderators`, {
      params: {
        broadcaster_id: broadcasterId,
        user_id: profile.id  // We can filter directly by the user ID we're checking
      },
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });
    
    // If the user is in the response data, they are a moderator
    console.log(`Received moderator response with status: ${response.status}`);
    
    if (response.data && response.data.data) {
      // For this endpoint, if we filtered by user_id and got any results, the user is a mod
      const isModerator = response.data.data.length > 0;
      console.log(`User ${profile.display_name} moderator status: ${isModerator}`);
      
      if (isModerator) {
        console.log(`User ${profile.display_name} is confirmed as a moderator`);
      } else {
        console.log(`User ${profile.display_name} is not a moderator of channel ${normalizedTargetChannel}`);
      }
      
      return isModerator;
    }
    
    console.log('No moderator data found in response');
    return false;
  } catch (error) {
    console.error('Error checking moderator status:', error.message);
    if (error.response) {
      console.error('Error response code:', error.response.status);
      console.error('Error response data:', error.response.data);
    }
    
    // If we're the channel owner, grant permission despite API errors
    if (profile.login.toLowerCase() === (process.env.CHANNEL_NAME || '').replace(/^#/, '').toLowerCase()) {
      console.log('API error but user is channel owner - granting access');
      return true;
    }
    return false;
  }
}

// Configure Twitch Strategy with fixed string callback URL
const twitchStrategyConfig = {
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  callbackURL: process.env.TWITCH_CALLBACK_URL,
  scope: ["user:read:email", "chat:read", "chat:edit", "channel:moderate"]
};

// Log the strategy configuration for debugging
console.log('Twitch Strategy Configuration:', {
  ...twitchStrategyConfig,
  clientSecret: '********' // Hide the secret
});

passport.use(new TwitchStrategy({
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  callbackURL: process.env.TWITCH_CALLBACK_URL,
  scope: ["user:read:email", "chat:read", "chat:edit", "channel:moderate"]
}, (accessToken, refreshToken, profile, done) => {
  console.log('Passport Twitch Strategy callback received');
  console.log('Profile ID:', profile.id);
  console.log('Access Token (first 10 chars):', accessToken.substring(0, 10) + '...');
  
  // Check if the user has a profile image
  let profileImage = null;
  if (profile.photos && profile.photos.length > 0) {
    profileImage = profile.photos[0].value;
  }
  
  // Create user object
  const user = {
    id: profile.id,
    displayName: profile.displayName,
    login: profile.login || profile.username,
    email: profile.email,
    profileImage: profileImage,
    accessToken
  };
  
  // Check if user is a moderator of the target channel
  const targetChannel = process.env.CHANNEL_NAME.toLowerCase();
  console.log(`Checking if user is moderator for channel: ${targetChannel}`);
  
  // If the user is the channel owner, they're automatically an admin
  if (user.login.toLowerCase() === targetChannel) {
    console.log('User is the channel owner - automatically granted admin access');
    user.isChannelModerator = true;
    user.isChannelOwner = true;
    return done(null, user);
  }
  
  // First, get the broadcaster ID for the target channel
  axios.get(`https://api.twitch.tv/helix/users?login=${targetChannel}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': process.env.TWITCH_CLIENT_ID
    }
  })
  .then(response => {
    if (!response.data.data || response.data.data.length === 0) {
      console.error(`Could not find broadcaster ID for channel: ${targetChannel}`);
      user.isChannelModerator = false;
      return done(null, user);
    }
    
    const broadcasterId = response.data.data[0].id;
    console.log(`Found broadcaster ID for ${targetChannel}: ${broadcasterId}`);
    
    // Now check if the user is a moderator for this channel
    return axios.get(`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${broadcasterId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });
  })
  .then(response => {
    const moderators = response.data.data;
    const isModerator = moderators.some(mod => mod.user_id === user.id);
    
    user.isChannelModerator = isModerator;
    console.log(`User moderation status for ${targetChannel}: ${isModerator ? 'IS MODERATOR' : 'NOT MODERATOR'}`);
    
    return done(null, user);
  })
  .catch(error => {
    console.error('Error checking moderator status:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    
    // If we can't verify moderator status, we'll still authenticate the user
    // but mark them as not a moderator
    user.isChannelModerator = false;
    return done(null, user);
  });
}));

module.exports = passport; 