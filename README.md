# Twitch Bot Dashboard

A web dashboard for managing Twitch bot commands. The dashboard allows moderators to create, edit, and delete commands for a Twitch bot.

## Features

- Twitch OAuth authentication
- Command management (add, edit, delete)
- Access control for moderators
- Real-time command updates to the bot

## Technology Stack

- **Backend**: Node.js, Express, MongoDB, Passport.js
- **Frontend**: HTML, CSS, JavaScript, TailwindCSS
- **Bot**: tmi.js for Twitch chat integration
- **Hosting**: Vercel (backend), GitHub Pages (frontend)

## Deployment

### Backend (Vercel)

1. Create a Vercel account and install the Vercel CLI
2. Connect your GitHub repository to Vercel
3. Set the following environment variables in Vercel:
   - `MONGODB_URI` - MongoDB connection string
   - `SESSION_SECRET` - Secret for session encryption
   - `TWITCH_CLIENT_ID` - Your Twitch application client ID
   - `TWITCH_CLIENT_SECRET` - Your Twitch application client secret
   - `TWITCH_CALLBACK_URL` - OAuth callback URL (your-vercel-domain.vercel.app/auth/twitch/callback)
   - `CHANNEL_NAME` - The Twitch channel where the bot will operate
   - `BOT_USERNAME` - Twitch bot account username
   - `BOT_TOKEN` - Twitch bot OAuth token
   - `NODE_ENV` - Set to 'production'

### Frontend (GitHub Pages)

1. Create a GitHub repository for the frontend
2. Copy the contents of the `github-pages` directory to the repository
3. Update `API_BASE_URL` in `github-pages/js/app.js` to point to your Vercel deployment
4. Enable GitHub Pages in the repository settings

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required environment variables
4. Start the server: `npm run dev`

## Environment Variables

```
MONGODB_URI=your_mongodb_connection_string
SESSION_SECRET=your_session_secret
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_CALLBACK_URL=http://localhost:3000/auth/twitch/callback
CHANNEL_NAME=your_channel_name
BOT_USERNAME=your_bot_username
BOT_TOKEN=your_bot_token
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 