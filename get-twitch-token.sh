#!/bin/bash
# Twitch OAuth Token Generator (Shell Script Version)
# Run with: bash get-twitch-token.sh

echo "=== Twitch OAuth Token Generator ==="
echo

# Check if .env file exists and source it
if [ -f .env ]; then
  echo "Loading variables from .env file"
  export $(grep -v '^#' .env | xargs)
fi

# Get Client ID
if [ -n "$TWITCH_CLIENT_ID" ]; then
  echo "Found TWITCH_CLIENT_ID in environment: ${TWITCH_CLIENT_ID:0:4}****${TWITCH_CLIENT_ID: -4}"
  read -p "Use this client ID? (y/n): " use_env_client_id
  
  if [ "$use_env_client_id" != "y" ]; then
    read -p "Enter your Twitch client ID: " client_id
  else
    client_id=$TWITCH_CLIENT_ID
  fi
else
  read -p "Enter your Twitch client ID: " client_id
fi

# Get Client Secret
if [ -n "$TWITCH_CLIENT_SECRET" ]; then
  echo "Found TWITCH_CLIENT_SECRET in environment: ${TWITCH_CLIENT_SECRET:0:4}****${TWITCH_CLIENT_SECRET: -4}"
  read -p "Use this client secret? (y/n): " use_env_client_secret
  
  if [ "$use_env_client_secret" != "y" ]; then
    read -p "Enter your Twitch client secret: " client_secret
  else
    client_secret=$TWITCH_CLIENT_SECRET
  fi
else
  read -p "Enter your Twitch client secret: " client_secret
fi

# Default scopes
default_scopes="chat:read chat:edit channel:moderate moderation:read"
read -p "Enter scopes (separated by spaces) or press Enter for defaults [$default_scopes]: " scopes
scopes=${scopes:-$default_scopes}

echo
echo "Choose the OAuth flow:"
echo "1. Client Credentials (for bot-only functionality)"
echo "2. Authorization Code (for acting on behalf of a user)"
read -p "Enter your choice (1 or 2): " flow_choice

if [ "$flow_choice" = "1" ]; then
  # Client credentials flow
  echo
  echo "Generating OAuth token..."
  
  response=$(curl -s -X POST "https://id.twitch.tv/oauth2/token" \
    -d "client_id=$client_id" \
    -d "client_secret=$client_secret" \
    -d "grant_type=client_credentials" \
    -d "scope=$scopes")
  
  # Extract token from response
  access_token=$(echo $response | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')
  token_type=$(echo $response | grep -o '"token_type":"[^"]*' | sed 's/"token_type":"//')
  expires_in=$(echo $response | grep -o '"expires_in":[0-9]*' | sed 's/"expires_in"://')
  
  if [ -n "$access_token" ]; then
    echo
    echo "=== OAuth Token Generated Successfully ==="
    echo "Access Token: $access_token"
    echo "Token Type: $token_type"
    echo "Expires In: $expires_in seconds"
    
    # Save to .env file
    read -p "Do you want to save this token to your .env file? (y/n): " save_to_env
    
    if [ "$save_to_env" = "y" ]; then
      if [ -f .env ]; then
        # Remove existing BOT_TOKEN line if present
        grep -v "^BOT_TOKEN=" .env > .env.tmp
        mv .env.tmp .env
      fi
      
      # Add the new token
      echo "BOT_TOKEN=$access_token" >> .env
      echo "Token saved to .env file as BOT_TOKEN"
    fi
    
    echo
    echo "For your bot configuration, use:"
    echo "BOT_TOKEN=$access_token"
  else
    echo "Error generating token. Response:"
    echo $response
  fi
  
elif [ "$flow_choice" = "2" ]; then
  # Authorization code flow
  read -p "Enter your redirect URI (e.g. http://localhost:3000/auth/twitch/callback): " redirect_uri
  
  # Generate authorization URL
  auth_url="https://id.twitch.tv/oauth2/authorize?client_id=$client_id&redirect_uri=$redirect_uri&response_type=code&scope=$scopes"
  
  echo
  echo "=== Authorization URL ==="
  echo "Open this URL in your browser:"
  echo "$auth_url"
  echo
  echo "After authorization, you will be redirected to your redirect URI with a code parameter."
  echo "Extract this code and use it with the Twitch token endpoint to get your access token."
  
  read -p "Enter the code from the redirect URL (or press Enter to skip): " auth_code
  
  if [ -n "$auth_code" ]; then
    echo "Exchanging code for token..."
    
    token_response=$(curl -s -X POST "https://id.twitch.tv/oauth2/token" \
      -d "client_id=$client_id" \
      -d "client_secret=$client_secret" \
      -d "code=$auth_code" \
      -d "grant_type=authorization_code" \
      -d "redirect_uri=$redirect_uri")
    
    # Extract tokens from response
    token_access_token=$(echo $token_response | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')
    token_refresh_token=$(echo $token_response | grep -o '"refresh_token":"[^"]*' | sed 's/"refresh_token":"//')
    token_type=$(echo $token_response | grep -o '"token_type":"[^"]*' | sed 's/"token_type":"//')
    token_expires_in=$(echo $token_response | grep -o '"expires_in":[0-9]*' | sed 's/"expires_in"://')
    
    if [ -n "$token_access_token" ]; then
      echo
      echo "=== OAuth Token Generated Successfully ==="
      echo "Access Token: $token_access_token"
      echo "Refresh Token: $token_refresh_token"
      echo "Token Type: $token_type"
      echo "Expires In: $token_expires_in seconds"
      
      # Save to .env file
      read -p "Do you want to save this token to your .env file? (y/n): " token_save_to_env
      
      if [ "$token_save_to_env" = "y" ]; then
        if [ -f .env ]; then
          # Remove existing BOT_TOKEN line if present
          grep -v "^BOT_TOKEN=" .env > .env.tmp
          mv .env.tmp .env
        fi
        
        # Add the new token
        echo "BOT_TOKEN=$token_access_token" >> .env
        echo "Token saved to .env file as BOT_TOKEN"
      fi
    else
      echo "Error exchanging code for token. Response:"
      echo $token_response
    fi
  fi
  
else
  echo "Invalid choice. Please run the script again and select 1 or 2."
fi

echo
echo "Done!" 