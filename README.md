# Twitch Bot Dashboard

A Twitch bot with a web dashboard that allows moderators to manage custom commands for their channel.

## Features

- **Twitch Authentication**: Users log in with their Twitch account
- **Moderator Access Control**: Only channel moderators can access the dashboard
- **Command Management**: Create, edit, delete, and toggle commands
- **User Level Permissions**: Set who can use each command (everyone, subscribers, VIPs, moderators, broadcaster)
- **Cooldown System**: Prevent command spam with customizable cooldowns
- **Responsive UI**: Works on desktop and mobile devices

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: HTML, CSS, JavaScript with Tailwind CSS
- **Database**: MongoDB
- **Authentication**: Passport.js with Twitch OAuth
- **Bot**: tmi.js (Twitch Messaging Interface)
- **Deployment**: Vercel

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- MongoDB database (local or Atlas)
- Twitch Developer Application

### Step 1: Clone the repository

```bash
git clone https://github.com/yourusername/twitch-bot-dashboard.git
cd twitch-bot-dashboard
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Set up environment variables

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```

Edit the `.env` file with your:
- MongoDB connection string
- Twitch application credentials
- Bot credentials
- Session secret

### Step 4: Create a Twitch Application

1. Go to [Twitch Developer Console](https://dev.twitch.tv/console/apps)
2. Create a new application
3. Set the OAuth Redirect URL to `http://localhost:3000/auth/twitch/callback` (for development)
4. Copy the Client ID and Client Secret to your `.env` file

### Step 5: Get a Twitch Bot Token

1. Visit [Twitch Token Generator](https://twitchapps.com/tmi/)
2. Connect with your bot account
3. Copy the OAuth token to your `.env` file

### Step 6: Start the development server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Deployment to Vercel

This project is configured for easy deployment to Vercel:

1. Push your code to a GitHub repository
2. Connect the repository to Vercel
3. Set up the environment variables in the Vercel dashboard
4. Deploy!

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 