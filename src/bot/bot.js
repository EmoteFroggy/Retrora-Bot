const tmi = require('tmi.js');
const Command = require('../models/command');

class TwitchBot {
  constructor(config) {
    this.username = config.username;
    this.token = config.token;
    this.channel = config.channel;
    this.commands = new Map();
    this.cooldowns = new Map();
    
    // Initialize the client
    this.client = new tmi.Client({
      options: { debug: process.env.NODE_ENV !== 'production' },
      identity: {
        username: this.username,
        password: this.token
      },
      channels: [this.channel]
    });
    
    // Set up event listeners
    this.client.on('message', this.onMessageHandler.bind(this));
    this.client.on('connected', this.onConnectedHandler.bind(this));
    this.client.on('disconnected', this.onDisconnectedHandler.bind(this));
    
    // Store global bot instance for reloading commands
    global.bot = this;
    
    // Load commands from the database
    this.loadCommands();
  }
  
  // Connect to Twitch
  connect() {
    this.client.connect().catch(console.error);
  }
  
  // Disconnect from Twitch
  disconnect() {
    this.client.disconnect().catch(console.error);
  }
  
  // Load commands from the database
  async loadCommands() {
    try {
      // Normalize channel name (removing # prefix and converting to lowercase)
      const channelName = this.channel.replace(/^#/, '').toLowerCase();
      
      console.log(`Looking for commands with channel: ${channelName}`);
      
      const commands = await Command.find({ 
        $or: [
          { channel: channelName },
          { channel: `#${channelName}` },
          { channel: this.channel }
        ],
        enabled: true 
      });
      
      this.commands.clear();
      commands.forEach(cmd => {
        this.commands.set(cmd.name.toLowerCase(), {
          response: cmd.response,
          cooldown: cmd.cooldown,
          userLevel: cmd.userLevel
        });
      });
      
      console.log(`Loaded ${commands.length} commands for channel ${this.channel}`);
      if (commands.length === 0) {
        console.log("No commands found. Make sure commands are being saved with the correct channel name.");
      } else {
        console.log("Commands loaded:", commands.map(c => `!${c.name}`).join(', '));
      }
    } catch (err) {
      console.error('Error loading commands:', err);
    }
  }
  
  // Handle incoming messages
  async onMessageHandler(channel, userstate, message, self) {
    // Ignore messages from the bot itself
    if (self) return;
    
    // Check if the message is a command
    if (!message.startsWith('!')) return;
    
    // Parse the command
    const args = message.slice(1).split(' ');
    const commandName = args.shift().toLowerCase();
    
    console.log(`Received command: !${commandName}`);
    
    // Check if the command exists
    if (!this.commands.has(commandName)) {
      console.log(`Command not found: !${commandName}`);
      return;
    }
    
    // Get the command
    const command = this.commands.get(commandName);
    
    // Check cooldown
    const now = Date.now();
    const cooldownKey = `${channel}-${commandName}`;
    if (this.cooldowns.has(cooldownKey)) {
      const cooldownExpiration = this.cooldowns.get(cooldownKey) + (command.cooldown * 1000);
      if (now < cooldownExpiration) return;
    }
    
    // Check user level
    const userLevel = this.getUserLevel(userstate);
    if (!this.hasPermission(userLevel, command.userLevel)) return;
    
    // Set cooldown
    this.cooldowns.set(cooldownKey, now);
    
    // Execute the command
    try {
      // Normalize channel name for database query
      const channelName = channel.replace(/^#/, '').toLowerCase();
      
      // Increment the usage count in the database
      await Command.findOneAndUpdate(
        { name: commandName, channel: channelName },
        { $inc: { useCount: 1 } }
      );
      
      // Send the response
      console.log(`Executing command !${commandName} with response: ${command.response}`);
      this.client.say(channel, command.response);
    } catch (err) {
      console.error(`Error executing command ${commandName}:`, err);
    }
  }
  
  // Get user permission level
  getUserLevel(userstate) {
    if (userstate.badges) {
      if (userstate.badges.broadcaster) return 'broadcaster';
      if (userstate.badges.moderator) return 'moderator';
      if (userstate.badges.vip) return 'vip';
    }
    
    if (userstate.subscriber) return 'subscriber';
    return 'everyone';
  }
  
  // Check if user has permission to use a command
  hasPermission(userLevel, requiredLevel) {
    const levels = ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'];
    const userLevelIndex = levels.indexOf(userLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel);
    
    return userLevelIndex >= requiredLevelIndex;
  }
  
  // Handle successful connection
  onConnectedHandler(addr, port) {
    console.log(`Bot connected to ${addr}:${port}`);
    console.log(`Bot joined channel: ${this.channel}`);
  }
  
  // Handle disconnection
  onDisconnectedHandler(reason) {
    console.log(`Bot disconnected: ${reason}`);
  }
  
  // Reload commands from the database
  async reloadCommands() {
    console.log("Reloading commands...");
    await this.loadCommands();
    return this.commands.size;
  }
}

module.exports = TwitchBot; 