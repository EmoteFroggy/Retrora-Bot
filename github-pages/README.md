# Twitch Bot Dashboard - Frontend

This repository contains the frontend for the Twitch Bot Dashboard. It's designed to be hosted on GitHub Pages and connect to a backend deployed on Vercel.

## Overview

The Twitch Bot Dashboard allows moderators to manage commands for a Twitch bot. This frontend provides a user interface for:

- Viewing all commands for a channel
- Adding new commands
- Editing existing commands
- Deleting commands

## Setup

1. Clone this repository
2. Update the `API_BASE_URL` in `js/app.js` to point to your Vercel deployment:
   ```js
   const API_BASE_URL = "https://your-vercel-app.vercel.app";
   ```
3. Enable GitHub Pages for this repository

## Authentication

The dashboard uses Twitch OAuth for authentication. Only users who are moderators of the specified channel will have access to manage commands.

## Frontend Technologies

- HTML5
- CSS3
- JavaScript (ES6+)
- TailwindCSS for styling

## Backend Repository

The backend code is available in a separate repository. 