/**
 * Twitch OAuth Token Generator
 * 
 * This script helps generate a Twitch OAuth token for bot use.
 * Run it with: node generate-twitch-token.js
 */

const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
require('dotenv').config(); // Load environment variables if available

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Client credentials from .env file or manual input
const envClientId = process.env.TWITCH_CLIENT_ID;
const envClientSecret = process.env.TWITCH_CLIENT_SECRET;

// Prompt for user input
async function promptUser() {
  try {
    console.log('\n=== Twitch OAuth Token Generator ===\n');
    
    // Get client ID
    const clientId = await new Promise(resolve => {
      if (envClientId) {
        console.log(`Using client ID from .env file: ${maskString(envClientId)}`);
        rl.question('Do you want to use this client ID? (y/n): ', answer => {
          if (answer.toLowerCase() === 'y') {
            resolve(envClientId);
          } else {
            rl.question('Please enter your Twitch client ID: ', resolve);
          }
        });
      } else {
        rl.question('Please enter your Twitch client ID: ', resolve);
      }
    });

    // Get client secret
    const clientSecret = await new Promise(resolve => {
      if (envClientSecret) {
        console.log(`Using client secret from .env file: ${maskString(envClientSecret)}`);
        rl.question('Do you want to use this client secret? (y/n): ', answer => {
          if (answer.toLowerCase() === 'y') {
            resolve(envClientSecret);
          } else {
            rl.question('Please enter your Twitch client secret: ', resolve);
          }
        });
      } else {
        rl.question('Please enter your Twitch client secret: ', resolve);
      }
    });

    // Get scopes
    const defaultScopes = 'chat:read chat:edit channel:moderate moderation:read';
    const scopes = await new Promise(resolve => {
      rl.question(`Please enter scopes (separated by spaces) or press Enter for defaults [${defaultScopes}]: `, answer => {
        resolve(answer || defaultScopes);
      });
    });

    return { clientId, clientSecret, scopes };
  } catch (error) {
    console.error('Error during prompt:', error);
    throw error;
  }
}

// Mask sensitive strings for display
function maskString(str) {
  if (!str) return '';
  if (str.length <= 8) return '****';
  return str.substring(0, 4) + '*'.repeat(str.length - 8) + str.substring(str.length - 4);
}

// Generate OAuth token
async function generateToken(clientId, clientSecret, scopes) {
  try {
    console.log('\nGenerating OAuth token...');
    
    // Client credentials flow
    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
        scope: scopes
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error generating token:', error.response?.data || error.message);
    throw error;
  }
}

// Generate OAuth token with authorization code flow
async function generateAuthUrl(clientId, redirectUri, scopes) {
  const url = new URL('https://id.twitch.tv/oauth2/authorize');
  url.searchParams.append('client_id', clientId);
  url.searchParams.append('redirect_uri', redirectUri);
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('scope', scopes);
  
  return url.toString();
}

// Main function
async function main() {
  try {
    const { clientId, clientSecret, scopes } = await promptUser();
    
    // Ask which flow to use
    const flowChoice = await new Promise(resolve => {
      console.log('\nChoose the OAuth flow:');
      console.log('1. Client Credentials (for bot-only functionality)');
      console.log('2. Authorization Code (for acting on behalf of a user)');
      rl.question('Enter your choice (1 or 2): ', resolve);
    });
    
    if (flowChoice === '1') {
      // Client credentials flow
      const tokenData = await generateToken(clientId, clientSecret, scopes);
      
      console.log('\n=== OAuth Token Generated Successfully ===');
      console.log('Access Token:', tokenData.access_token);
      console.log('Token Type:', tokenData.token_type);
      console.log('Expires In:', tokenData.expires_in, 'seconds');
      
      // Save to .env file
      const saveToEnv = await new Promise(resolve => {
        rl.question('\nDo you want to save this token to your .env file? (y/n): ', resolve);
      });
      
      if (saveToEnv.toLowerCase() === 'y') {
        try {
          let envContent = '';
          if (fs.existsSync('.env')) {
            envContent = fs.readFileSync('.env', 'utf8');
          }
          
          // Remove existing BOT_TOKEN line if present
          envContent = envContent
            .split('\n')
            .filter(line => !line.startsWith('BOT_TOKEN='))
            .join('\n');
            
          // Add the new token
          envContent += `\nBOT_TOKEN=${tokenData.access_token}\n`;
          
          fs.writeFileSync('.env', envContent);
          console.log('Token saved to .env file as BOT_TOKEN');
        } catch (error) {
          console.error('Error saving to .env file:', error.message);
        }
      }
      
      console.log('\nFor your bot configuration, use:');
      console.log(`BOT_TOKEN=${tokenData.access_token}`);
      
    } else if (flowChoice === '2') {
      // Authorization code flow
      const redirectUri = await new Promise(resolve => {
        rl.question('Enter your redirect URI (e.g. http://localhost:3000/auth/twitch/callback): ', resolve);
      });
      
      const authUrl = generateAuthUrl(clientId, redirectUri, scopes);
      
      console.log('\n=== Authorization URL ===');
      console.log('Open this URL in your browser:');
      console.log(authUrl);
      console.log('\nAfter authorization, you will be redirected to your redirect URI with a code parameter.');
      console.log('Extract this code and use it with the Twitch token endpoint to get your access token.');
      
      const code = await new Promise(resolve => {
        rl.question('\nEnter the code from the redirect URL (or press Enter to skip): ', resolve);
      });
      
      if (code) {
        try {
          const tokenResponse = await axios.post('https://id.twitch.tv/oauth2/token', null, {
            params: {
              client_id: clientId,
              client_secret: clientSecret,
              code: code,
              grant_type: 'authorization_code',
              redirect_uri: redirectUri
            }
          });
          
          console.log('\n=== OAuth Token Generated Successfully ===');
          console.log('Access Token:', tokenResponse.data.access_token);
          console.log('Refresh Token:', tokenResponse.data.refresh_token);
          console.log('Token Type:', tokenResponse.data.token_type);
          console.log('Expires In:', tokenResponse.data.expires_in, 'seconds');
          
          // Save to .env file
          const saveToEnv = await new Promise(resolve => {
            rl.question('\nDo you want to save this token to your .env file? (y/n): ', resolve);
          });
          
          if (saveToEnv.toLowerCase() === 'y') {
            try {
              let envContent = '';
              if (fs.existsSync('.env')) {
                envContent = fs.readFileSync('.env', 'utf8');
              }
              
              // Remove existing BOT_TOKEN line if present
              envContent = envContent
                .split('\n')
                .filter(line => !line.startsWith('BOT_TOKEN='))
                .join('\n');
                
              // Add the new token
              envContent += `\nBOT_TOKEN=${tokenResponse.data.access_token}\n`;
              
              fs.writeFileSync('.env', envContent);
              console.log('Token saved to .env file as BOT_TOKEN');
            } catch (error) {
              console.error('Error saving to .env file:', error.message);
            }
          }
        } catch (error) {
          console.error('Error exchanging code for token:', error.response?.data || error.message);
        }
      }
    } else {
      console.log('Invalid choice. Please run the script again and select 1 or 2.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    rl.close();
  }
}

// Run the script
main(); 