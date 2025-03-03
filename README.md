# Retrora Bot Dashboard

A Twitch bot dashboard for the Retrora Bot, allowing moderators to manage commands for the EmoteFroggy channel.

## Live Links

- **Frontend (GitHub Pages)**: [https://emotefroggy.github.io/Retrora-Bot](https://emotefroggy.github.io/Retrora-Bot)
- **Backend (Vercel)**: [https://retrora-bot.vercel.app](https://retrora-bot.vercel.app)

## Features

- Authentication with Twitch
- Command management (add, edit, delete)
- Role-based access (moderators only)
- Real-time command updates

## Deployment Instructions

### Backend Deployment (Vercel)

1. Create a Vercel account if you don't have one: [https://vercel.com](https://vercel.com)
2. Install the Vercel CLI: `npm install -g vercel`
3. Log in to your Vercel account: `vercel login`
4. From the project directory, deploy the project: `vercel`
5. Set up the environment variables in the Vercel dashboard:
   - Go to your project settings
   - Add the environment variables from `.env.example`
   - Make sure to update all URLs to production URLs

### Frontend Deployment (GitHub Pages)

1. Create a new GitHub repository: `Retrora-Bot`
2. Copy the files from the `github-pages` directory to the repository root
3. Push to GitHub
4. Go to repository settings → Pages
5. Set the source to the main branch and save
6. Your site will be published at `https://yourusername.github.io/Retrora-Bot`

## Environment Variables

The following environment variables need to be set in your Vercel deployment:

```
# Production URLs
FRONTEND_URL=https://emotefroggy.github.io/Retrora-Bot
BACKEND_URL=https://retrora-bot.vercel.app

# Twitch API
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_CALLBACK_URL=https://retrora-bot.vercel.app/auth/twitch/callback

# Bot Configuration
BOT_USERNAME=your_bot_username
BOT_TOKEN=oauth:your_bot_token
CHANNEL_NAME=EmoteFroggy

# MongoDB
MONGODB_URI=your_mongodb_connection_string

# Session
SESSION_SECRET=your_session_secret
NODE_ENV=production
```

## Local Development

1. Clone the repository
2. Create a `.env` file based on `.env.example`
3. Install dependencies: `npm install`
4. Start the development server: `npm run dev`

## Authentication Setup

1. Create a Twitch application at [dev.twitch.tv](https://dev.twitch.tv/console/apps)
2. Set the OAuth Redirect URL to `http://localhost:3000/auth/twitch/callback` for local development and `https://retrora-bot.vercel.app/auth/twitch/callback` for production
3. Get your Client ID and Client Secret
4. Update your `.env` file with these credentials

## Bot Token Generation

1. Visit [twitchapps.com/tmi](https://twitchapps.com/tmi/) and authenticate with the bot account
2. Copy the generated OAuth token (it should start with "oauth:")
3. Add it to your `.env` file as `BOT_TOKEN`

## License

This project is licensed under the MIT License. 