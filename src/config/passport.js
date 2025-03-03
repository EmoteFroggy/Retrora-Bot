const passport = require('passport');
const TwitchStrategy = require('passport-twitch-new').Strategy;
const mongoose = require('mongoose');
const User = require('../models/user');
const axios = require('axios');

// Log environment information at startup for debugging
console.log('Passport configuration loading...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('TWITCH_CALLBACK_URL:', process.env.TWITCH_CALLBACK_URL);

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
  scope: [
    'moderation:read',         // Read moderation data, including moderators
    'channel:moderate',        // Perform moderation actions
    'chat:read',               // Read chat messages
    'chat:edit'                // Send chat messages (for bot functionality)
  ],
  passReqToCallback: true
};

// Log the strategy configuration for debugging
console.log('Twitch Strategy Configuration:', {
  ...twitchStrategyConfig,
  clientSecret: '********' // Hide the secret
});

passport.use(new TwitchStrategy(twitchStrategyConfig, async (req, accessToken, refreshToken, profile, done) => {
  try {
    console.log('Twitch authentication callback triggered for user:', profile.display_name);
    
    // Log the profile structure to debug
    console.log('Profile structure:', JSON.stringify({
      id: profile.id,
      login: profile.login,
      displayName: profile.display_name,
      // email removed
      // Don't log the full profile as it may be large
      hasJsonData: !!profile._json
    }));
    
    // Check if this user is a moderator of any channel
    const isModerator = await checkModeratorStatus(accessToken, profile.id, profile);

    console.log('Twitch authentication for:', profile.login, profile.display_name);
    console.log('Callback URL used:', process.env.TWITCH_CALLBACK_URL);
    
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
    
    // Set the moderatedChannels array - either contains the target channel or empty
    const moderatedChannels = [];
    if (isModerator || isChannelOwner) {
      moderatedChannels.push(targetChannel);
    }
    
    console.log(`User ${profile.display_name} moderated channels: ${moderatedChannels.join(', ')}`);
    
    // Extract profile image URL safely
    let profileImageUrl = null;
    if (profile._json && profile._json.profile_image_url) {
      profileImageUrl = profile._json.profile_image_url;
    } else if (profile.photos && profile.photos.length > 0) {
      profileImageUrl = profile.photos[0].value;
    }
    
    console.log(`Profile image URL: ${profileImageUrl || 'Not available'}`);
    
    // Check if user exists
    let user = await User.findOne({ twitchId: profile.id });
    
    if (!user) {
      console.log(`Creating new user for ${profile.display_name}`);
      // Create new user
      user = new User({
        twitchId: profile.id,
        displayName: profile.display_name || profile.username || profile.login,
        profileImage: profileImageUrl,
        accessToken,
        refreshToken,
        moderatedChannels: moderatedChannels,
        isAdmin: isChannelOwner // Make channel owner an admin
      });
    } else {
      console.log(`Updating existing user for ${profile.display_name}`);
      // Update existing user
      user.displayName = profile.display_name || profile.username || profile.login;
      if (profileImageUrl) {
        user.profileImage = profileImageUrl;
      }
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