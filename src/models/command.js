const mongoose = require('mongoose');

const commandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  response: {
    type: String,
    required: true
  },
  channel: {
    type: String,
    required: true
  },
  cooldown: {
    type: Number,
    default: 5
  },
  userLevel: {
    type: String,
    enum: ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'],
    default: 'everyone'
  },
  enabled: {
    type: Boolean,
    default: true
  },
  useCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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
commandSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Create a compound index to ensure command names are unique per channel
commandSchema.index({ name: 1, channel: 1 }, { unique: true });

module.exports = mongoose.models.Command || mongoose.model('Command', commandSchema); 