const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  twitchId: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: String,
  profileImage: String,
  accessToken: String,
  refreshToken: String,
  moderatedChannels: [{
    type: String,
    required: true
  }],
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the timestamp before saving
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Check if user is a moderator for a specific channel
userSchema.methods.isModeratorOf = function(channelName) {
  if (!channelName) return false;
  
  // Normalize the input channel name (remove # prefix and convert to lowercase)
  const normalizedChannel = channelName.replace(/^#/, '').toLowerCase();
  
  // Normalize all moderatedChannels in the array
  const normalizedModeratedChannels = this.moderatedChannels.map(channel => 
    channel.replace(/^#/, '').toLowerCase()
  );
  
  // For debugging
  console.log(`Checking if user ${this.displayName} is moderator of ${normalizedChannel}`);
  console.log(`User's moderated channels: ${normalizedModeratedChannels.join(', ')}`);
  
  // Check if the user is a moderator of the channel
  const isModerator = normalizedModeratedChannels.includes(normalizedChannel);
  console.log(`Is moderator: ${isModerator}`);
  
  return isModerator || this.isAdmin;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema); 