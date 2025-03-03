# MongoDB Setup for Twitch Bot Dashboard

This guide will help you set up MongoDB for your Twitch Bot Dashboard running on Vercel.

## 1. Create a MongoDB Atlas Account

If you don't have one already, create a free MongoDB Atlas account:

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up for a free account
3. Create a new project

## 2. Create a MongoDB Cluster

1. In your MongoDB Atlas dashboard, click "Build a Database"
2. Choose the "Free" shared cluster option
3. Select your preferred cloud provider and region
4. Click "Create Cluster" - this may take a few minutes to provision

## 3. Set Up Database Access

1. In the left sidebar, navigate to "Database Access" under Security
2. Click "Add New Database User"
3. Create a username and password (use a strong password and save it securely)
4. Set privileges to "Read and Write to Any Database"
5. Click "Add User"

## 4. Set Up Network Access (IMPORTANT FOR VERCEL)

1. In the left sidebar, navigate to "Network Access" under Security
2. Click "Add IP Address"
3. **IMPORTANT:** For Vercel serverless functions, you MUST select "Allow Access from Anywhere" (0.0.0.0/0)
   - This is required because Vercel uses dynamic IP addresses that change frequently
   - Without this setting, your application will face connection errors
4. Click "Confirm"
5. Wait for the status to change from "Pending" to "Active" (may take a few minutes)

## 5. Get Your Connection String

1. In your cluster dashboard, click "Connect"
2. Choose "Connect your application"
3. Select "Node.js" and version "4.1 or later"
4. Copy the connection string provided
5. Replace `<password>` with your database user's password (make sure to URL encode it if it contains special characters)
6. Replace `<dbname>` with a name for your database (e.g., "twitch-bot-dashboard")
7. Add `retryWrites=true&w=majority` at the end if not already present

Example connection string:
```
mongodb+srv://username:password@cluster0.abcde.mongodb.net/twitch-bot-dashboard?retryWrites=true&w=majority
```

## 6. Add the Connection String to Vercel

1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add a new environment variable:
   - Name: `MONGODB_URI`
   - Value: Your MongoDB connection string
4. Also add the SESSION_SECRET:
   - Name: `SESSION_SECRET`
   - Value: Your long random string generated earlier
5. Click "Save"
6. Redeploy your application for the changes to take effect

## 7. Test the Connection

After deploying, check the Vercel logs to make sure the connection is successful. You should see:
```
Connecting to MongoDB...
Connected to MongoDB successfully
```

## Troubleshooting Connection Issues

If you see errors like "Could not connect to any servers in your MongoDB Atlas cluster" or "Operation buffering timed out":

1. **Double-check your Network Access settings:**
   - Go to "Network Access" in MongoDB Atlas
   - Ensure there is an entry for "0.0.0.0/0" (Allow access from anywhere)
   - Status should be "Active" not "Pending"

2. **Verify your connection string:**
   - Make sure your username and password are correct
   - Ensure special characters in your password are URL encoded
   - Check that the cluster name matches what's in your Atlas dashboard

3. **Check cluster status:**
   - Ensure your MongoDB Atlas cluster is active and not in maintenance mode
   - For free tiers, clusters can be paused after inactivity

4. **Adjust timeouts in your database configuration:**
   - If your application faces intermittent connection issues, you might need to increase the `serverSelectionTimeoutMS` and `connectTimeoutMS` options

5. **Redeploy your application:**
   - Sometimes a fresh deployment is needed after changing environment variables

## Local Development

For local development, add the same `MONGODB_URI` to your `.env` file:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/twitch-bot-dashboard?retryWrites=true&w=majority
SESSION_SECRET=your-long-random-secret-key
``` 