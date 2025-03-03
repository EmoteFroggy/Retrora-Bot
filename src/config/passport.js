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
    if (!username || !accessToken) {
      console.error('Missing username or access token for Twitch API call');
      return null;
    }
    
    console.log(`Getting Twitch user ID for: ${username}`);
    
    const response = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });
    
    if (!response || !response.data) {
      console.log(`Empty response when looking up ${username}`);
      return null;
    }
    
    // Debug the response structure
    console.log('User lookup response structure:', JSON.stringify(response.data).substring(0, 200) + '...');
    
    if (response.data && response.data.data && response.data.data.length > 0) {
      const userId = response.data.data[0].id;
      console.log(`Found user ID for ${username}: ${userId}`);
      return userId;
    }
    
    console.log(`No user ID found for ${username}`);
    return null;
  } catch (error) {
    console.error(`Error getting Twitch user ID for ${username}:`, error.message);
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response.data || {}).substring(0, 500));
    }
    return null;
  }
}

// Check if user is a moderator (or broadcaster) of the target channel
async function checkModeratorStatus(accessToken, userId, profile) {
  try {
    // Ensure profile has necessary properties
    if (!profile || !profile.id || !profile.login) {
      console.error('Invalid profile object received:', profile);
      return false;
    }
    
    // Safe access to profile properties
    const profileId = profile.id;
    const profileLogin = profile.login || '';
    const displayName = profile.display_name || profileLogin || 'Unknown User';
    
    // Get the target channel name
    const targetChannelName = process.env.CHANNEL_NAME || '';
    
    if (!targetChannelName) {
      console.warn('No target channel specified in environment variables');
      return false;
    }
    
    // Normalize channel name
    const normalizedTargetChannel = targetChannelName.replace(/^#/, '').toLowerCase();
    
    console.log(`Checking if user ${displayName} (ID: ${profileId}) is a moderator of channel: ${normalizedTargetChannel}`);
    
    // If user is the channel owner/broadcaster, they have permission
    if (profileLogin.toLowerCase() === normalizedTargetChannel.toLowerCase()) {
      console.log(`User ${displayName} is the broadcaster - automatic permission granted`);
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
      const isModerator = response.data.data.some(mod => mod.user_id === profileId);
      console.log(`User ${displayName} moderator status: ${isModerator}`);
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
    const targetChannel = (process.env.CHANNEL_NAME || '').replace(/^#/, '').toLowerCase();
    const userLogin = profile && profile.login ? profile.login.toLowerCase() : '';
    
    if (userLogin && targetChannel && userLogin === targetChannel) {
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
  callbackURL: process.env.TWITCH_CALLBACK_URL || 'https://retrora-bot.vercel.app/auth/twitch/callback',
  scope: 'user:read:email channel:moderate chat:edit chat:read moderation:read',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Raw Twitch profile received:', JSON.stringify({
      id: profile.id,
      login: profile.login,
      display_name: profile.display_name,
      has_json: !!profile._json
    }));
    
    const displayName = profile.display_name || profile.login || 'Unknown User';
    console.log(`Processing authentication for: ${displayName}`);
    
    // Safely get properties from potentially incomplete profile
    const profileData = {
      id: profile.id,
      login: (profile.login || '').toLowerCase(),
      displayName: profile.display_name || profile.login || 'Unknown User',
      email: profile.email || null
    };
    
    // Get target channel from environment variables (with fallback)
    let targetChannel = '';
    if (process.env.CHANNEL_NAME) {
      targetChannel = process.env.CHANNEL_NAME.replace(/^#/, '').toLowerCase();
      console.log(`Target channel from environment: ${targetChannel}`);
    } else {
      console.warn('No CHANNEL_NAME environment variable set');
    }
    
    // Check if user is broadcaster (channel owner)
    const isChannelOwner = profileData.login === targetChannel;
    console.log(`User ${profileData.displayName} is channel owner: ${isChannelOwner}`);
    
    // Check moderator status - channel owner is always considered a moderator
    let isModerator = isChannelOwner;
    if (!isChannelOwner) {
      console.log(`Checking if ${profileData.displayName} is a moderator of ${targetChannel}`);
      isModerator = await checkModeratorStatus(accessToken, profileData.id, profile);
    }
    
    console.log(`User ${profileData.displayName} moderator status result: ${isModerator}`);
    
    // Set the moderatedChannels array - either contains the target channel or empty
    const moderatedChannels = [];
    if (isModerator || isChannelOwner) {
      moderatedChannels.push(targetChannel);
    }
    
    console.log(`User ${profileData.displayName} moderated channels: ${moderatedChannels.join(', ')}`);
    
    try {
      // Check if user exists
      let user = await User.findOne({ twitchId: profileData.id });
      
      // Get profile image URL safely
      const profileImageUrl = profile._json && profile._json.profile_image_url ? 
                             profile._json.profile_image_url : 
                             null;
      
      if (!user) {
        console.log(`Creating new user for ${profileData.displayName}`);
        // Create new user
        user = new User({
          twitchId: profileData.id,
          displayName: profileData.displayName,
          email: profileData.email,
          profileImage: profileImageUrl,
          accessToken,
          refreshToken,
          moderatedChannels: moderatedChannels,
          isAdmin: isChannelOwner // Make channel owner an admin
        });
      } else {
        console.log(`Updating existing user for ${profileData.displayName}`);
        // Update existing user
        user.displayName = profileData.displayName;
        if (profileData.email) {
          user.email = profileData.email;
        }
        
        // Only update profile image if we have a new one
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
    } catch (dbError) {
      console.error('Database error during user save:', dbError);
      // Create a minimal user object if DB operations fail
      const fallbackUser = {
        id: Math.random().toString(36).substring(2, 15),
        twitchId: profileData.id,
        displayName: profileData.displayName,
        moderatedChannels: moderatedChannels,
        isAdmin: isChannelOwner
      };
      console.log('Created fallback user due to DB error');
      return done(null, fallbackUser);
    }
  } catch (err) {
    console.error('Passport authentication error:', err);
    return done(err, null);
  }
}));

module.exports = passport; 