const passport = require('passport');
const TwitchStrategy = require('passport-twitch-new').Strategy;
const mongoose = require('mongoose');
const User = require('../models/user');
const axios = require('axios');

// Serialize user into the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
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
    
    // Check if user is a moderator
    console.log(`Checking moderation status with endpoint: /helix/moderation/moderators?broadcaster_id=${broadcasterId}`);
    const response = await axios.get(`https://api.twitch.tv/helix/moderation/moderators?broadcaster_id=${broadcasterId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });
    
    console.log(`Received moderator list response with ${response.data?.data?.length || 0} moderators`);
    
    if (response.data && response.data.data) {
      // Look for the user in the moderator list
      console.log('Moderator list:', response.data.data.map(mod => `${mod.user_name} (${mod.user_id})`).join(', '));
      const isModerator = response.data.data.some(mod => mod.user_id === profile.id);
      console.log(`User ${profile.display_name} moderator status: ${isModerator}`);
      return isModerator;
    }
    
    console.log('No moderators found in response');
    return false;
  } catch (error) {
    console.error('Error checking moderator status:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    
    // If we're the channel owner, grant permission despite API errors
    if (profile.login.toLowerCase() === (process.env.CHANNEL_NAME || '').replace(/^#/, '').toLowerCase()) {
      console.log('API error but user is channel owner - granting access');
      return true;
    }
    return false;
  }
}

// Initialize Twitch strategy
passport.use(new TwitchStrategy({
  clientID: process.env.TWITCH_CLIENT_ID,
  clientSecret: process.env.TWITCH_CLIENT_SECRET,
  callbackURL: process.env.TWITCH_CALLBACK_URL || 'http://localhost:3000/auth/twitch/callback',
  scope: 'user:read:email channel:moderate chat:edit chat:read moderation:read',
  state: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Twitch authentication for:', profile.login, profile.display_name);
    
    // Get target channel from environment variables (with fallback)
    let targetChannel = '';
    if (process.env.CHANNEL_NAME) {
      targetChannel = process.env.CHANNEL_NAME.replace(/^#/, '').toLowerCase();
      console.log(`Target channel from environment: ${targetChannel}`);
    } else {
      console.warn('No CHANNEL_NAME environment variable set');
    }
    
    // Check if user is broadcaster (channel owner)
    const isChannelOwner = profile.login.toLowerCase() === targetChannel.toLowerCase();
    console.log(`User ${profile.display_name} is channel owner: ${isChannelOwner}`);
    
    // Check moderator status - channel owner is always considered a moderator
    let isModerator = isChannelOwner;
    if (!isChannelOwner) {
      console.log(`Checking if ${profile.display_name} is a moderator of ${targetChannel}`);
      isModerator = await checkModeratorStatus(accessToken, profile.id, profile);
    }
    
    console.log(`User ${profile.display_name} moderator status result: ${isModerator}`);
    
    // Set the moderatedChannels array - either contains the target channel or empty
    const moderatedChannels = [];
    if (isModerator || isChannelOwner) {
      moderatedChannels.push(targetChannel);
    }
    
    console.log(`User ${profile.display_name} moderated channels: ${moderatedChannels.join(', ')}`);
    
    // Check if user exists
    let user = await User.findOne({ twitchId: profile.id });
    
    if (!user) {
      console.log(`Creating new user for ${profile.display_name}`);
      // Create new user
      user = new User({
        twitchId: profile.id,
        displayName: profile.display_name || profile.username,
        email: profile.email,
        profileImage: profile._json.profile_image_url,
        accessToken,
        refreshToken,
        moderatedChannels: moderatedChannels,
        isAdmin: isChannelOwner // Make channel owner an admin
      });
    } else {
      console.log(`Updating existing user for ${profile.display_name}`);
      // Update existing user
      user.displayName = profile.display_name || profile.username;
      user.email = profile.email;
      user.profileImage = profile._json.profile_image_url;
      user.accessToken = accessToken;
      user.refreshToken = refreshToken;
      user.moderatedChannels = moderatedChannels;
      user.isAdmin = isChannelOwner || user.isAdmin; // Keep admin status if already admin
    }
    
    // Save the user
    await user.save();
    console.log(`User saved successfully: ${user.displayName}, admin: ${user.isAdmin}, moderated channels: ${user.moderatedChannels.join(', ')}`);
    
    return done(null, user);
  } catch (err) {
    console.error('Passport authentication error:', err);
    return done(err, null);
  }
}));

module.exports = passport; 