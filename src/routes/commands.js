const express = require('express');
const router = express.Router();
const Command = require('../models/command');
const auth = require('./auth');
const TwitchBot = require('../bot/bot');

// Target channel from environment
const TARGET_CHANNEL = process.env.CHANNEL_NAME 
  ? process.env.CHANNEL_NAME.replace(/^#/, '').toLowerCase() 
  : '';

// Debug route to view all commands in database
router.get('/debug', async (req, res) => {
  try {
    const allCommands = await Command.find({});
    res.json({
      total: allCommands.length,
      commands: allCommands
    });
  } catch (err) {
    console.error('Error getting debug commands:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all commands for a channel
router.get('/:channel', auth.isAuthenticated, async (req, res) => {
  try {
    const { channel } = req.params;
    const normalizedChannel = channel.replace(/^#/, '').toLowerCase();
    
    // For single channel mode, we only care if they can access the target channel
    if (normalizedChannel !== TARGET_CHANNEL) {
      console.log(`Request for non-target channel: ${normalizedChannel} vs ${TARGET_CHANNEL}`);
      return res.status(403).json({ error: 'Forbidden - Access only allowed for target channel' });
    }
    
    // Check if user has the channel in their moderatedChannels
    const canAccess = req.user.moderatedChannels && 
                     req.user.moderatedChannels.includes(TARGET_CHANNEL);
    
    // Allow admin or moderator access                 
    if (!canAccess && !req.user.isAdmin) {
      console.log(`User ${req.user.displayName} doesn't have ${TARGET_CHANNEL} in moderated channels`);
      console.log(`User's moderated channels: ${req.user.moderatedChannels?.join(', ') || 'none'}`);
      return res.status(403).json({ error: 'Forbidden - Not a moderator' });
    }
    
    const commands = await Command.find({ channel: normalizedChannel }).sort({ name: 1 });
    res.json(commands);
  } catch (err) {
    console.error('Error fetching commands:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new command
router.post('/:channel', auth.isAuthenticated, async (req, res) => {
  try {
    const { channel } = req.params;
    const { name, response, cooldown, userLevel } = req.body;
    
    // Normalize channel name
    const normalizedChannel = channel.replace(/^#/, '').toLowerCase();
    
    // For single channel mode, only allow target channel
    if (normalizedChannel !== TARGET_CHANNEL) {
      return res.status(403).json({ error: 'Forbidden - Access only allowed for target channel' });
    }
    
    // Check if user has the channel in their moderatedChannels
    const canAccess = req.user.moderatedChannels && 
                     req.user.moderatedChannels.includes(TARGET_CHANNEL);
                     
    if (!canAccess && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Not a moderator' });
    }
    
    // Normalize command name (remove ! prefix if present)
    const normalizedName = name.replace(/^!/, '').toLowerCase();
    
    // Validate input
    if (!normalizedName || !response) {
      return res.status(400).json({ error: 'Name and response are required' });
    }
    
    // Check if command already exists
    const existingCommand = await Command.findOne({ 
      name: normalizedName, 
      channel: normalizedChannel 
    });
    
    if (existingCommand) {
      return res.status(400).json({ error: 'Command already exists' });
    }
    
    // Create new command
    const command = new Command({
      name: normalizedName,
      response,
      channel: normalizedChannel,
      cooldown: cooldown || 5,
      userLevel: userLevel || 'everyone',
      createdBy: req.user._id
    });
    
    await command.save();
    console.log("Command saved:", command);
    
    // Reload bot commands if bot is running
    if (global.bot) {
      console.log("Attempting to reload commands...");
      const commandCount = await global.bot.reloadCommands();
      console.log(`Bot reloaded with ${commandCount} commands`);
    } else {
      console.log("No bot instance available to reload commands");
    }
    
    res.status(201).json(command);
  } catch (err) {
    console.error('Error creating command:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a command
router.put('/:channel/:id', auth.isAuthenticated, async (req, res) => {
  try {
    const { channel, id } = req.params;
    const { name, response, cooldown, userLevel, enabled } = req.body;
    
    // Normalize channel name
    const normalizedChannel = channel.replace(/^#/, '').toLowerCase();
    
    // For single channel mode, only allow target channel
    if (normalizedChannel !== TARGET_CHANNEL) {
      return res.status(403).json({ error: 'Forbidden - Access only allowed for target channel' });
    }
    
    // Check if user has the channel in their moderatedChannels
    const canAccess = req.user.moderatedChannels && 
                     req.user.moderatedChannels.includes(TARGET_CHANNEL);
                     
    if (!canAccess && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Not a moderator' });
    }
    
    // Find the command
    const command = await Command.findOne({ _id: id, channel: normalizedChannel });
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    // Update command
    if (name) command.name = name.replace(/^!/, '').toLowerCase();
    if (response) command.response = response;
    if (cooldown !== undefined) command.cooldown = cooldown;
    if (userLevel) command.userLevel = userLevel;
    if (enabled !== undefined) command.enabled = enabled;
    
    await command.save();
    console.log("Command updated:", command);
    
    // Reload bot commands if bot is running
    if (global.bot) {
      console.log("Attempting to reload commands after update...");
      const commandCount = await global.bot.reloadCommands();
      console.log(`Bot reloaded with ${commandCount} commands`);
    } else {
      console.log("No bot instance available to reload commands");
    }
    
    res.json(command);
  } catch (err) {
    console.error('Error updating command:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a command
router.delete('/:channel/:id', auth.isAuthenticated, async (req, res) => {
  try {
    const { channel, id } = req.params;
    
    // Normalize channel name
    const normalizedChannel = channel.replace(/^#/, '').toLowerCase();
    
    // For single channel mode, only allow target channel
    if (normalizedChannel !== TARGET_CHANNEL) {
      return res.status(403).json({ error: 'Forbidden - Access only allowed for target channel' });
    }
    
    // Check if user has the channel in their moderatedChannels
    const canAccess = req.user.moderatedChannels && 
                     req.user.moderatedChannels.includes(TARGET_CHANNEL);
                     
    if (!canAccess && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Forbidden - Not a moderator' });
    }
    
    // Find and delete the command
    const command = await Command.findOneAndDelete({ _id: id, channel: normalizedChannel });
    if (!command) {
      return res.status(404).json({ error: 'Command not found' });
    }
    
    console.log("Command deleted:", command.name);
    
    // Reload bot commands if bot is running
    if (global.bot) {
      console.log("Attempting to reload commands after deletion...");
      const commandCount = await global.bot.reloadCommands();
      console.log(`Bot reloaded with ${commandCount} commands`);
    } else {
      console.log("No bot instance available to reload commands");
    }
    
    res.json({ message: 'Command deleted successfully' });
  } catch (err) {
    console.error('Error deleting command:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 