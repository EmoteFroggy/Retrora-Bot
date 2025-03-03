# Twitch OAuth Token Generator (PowerShell Version)
# Run with: .\Get-TwitchToken.ps1

Write-Host "=== Twitch OAuth Token Generator ===" -ForegroundColor Cyan
Write-Host

# Load .env file if it exists
$EnvFile = ".\.env"
$EnvVars = @{}

if (Test-Path $EnvFile) {
    Write-Host "Loading variables from .env file" -ForegroundColor Green
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^([^#=]+)=(.*)$") {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $EnvVars[$key] = $value
            Set-Variable -Name $key -Value $value -Scope Script
        }
    }
}

# Helper function to mask sensitive info
function Mask-String {
    param([string]$str)
    
    if (-not $str -or $str.Length -le 8) {
        return "****"
    }
    return $str.Substring(0, 4) + "*" * ($str.Length - 8) + $str.Substring($str.Length - 4)
}

# Get Client ID
$ClientId = ""
if ($EnvVars.ContainsKey("TWITCH_CLIENT_ID")) {
    $MaskedClientId = Mask-String $EnvVars["TWITCH_CLIENT_ID"]
    Write-Host "Found TWITCH_CLIENT_ID in environment: $MaskedClientId" -ForegroundColor Green
    $UseEnvClientId = Read-Host "Use this client ID? (y/n)"
    
    if ($UseEnvClientId -eq "y") {
        $ClientId = $EnvVars["TWITCH_CLIENT_ID"]
    }
}

if (-not $ClientId) {
    $ClientId = Read-Host "Enter your Twitch client ID"
}

# Get Client Secret
$ClientSecret = ""
if ($EnvVars.ContainsKey("TWITCH_CLIENT_SECRET")) {
    $MaskedClientSecret = Mask-String $EnvVars["TWITCH_CLIENT_SECRET"]
    Write-Host "Found TWITCH_CLIENT_SECRET in environment: $MaskedClientSecret" -ForegroundColor Green
    $UseEnvClientSecret = Read-Host "Use this client secret? (y/n)"
    
    if ($UseEnvClientSecret -eq "y") {
        $ClientSecret = $EnvVars["TWITCH_CLIENT_SECRET"]
    }
}

if (-not $ClientSecret) {
    $ClientSecret = Read-Host "Enter your Twitch client secret"
}

# Get scopes
$DefaultScopes = "chat:read chat:edit channel:moderate moderation:read"
$ScopesPrompt = Read-Host "Enter scopes (separated by spaces) or press Enter for defaults [$DefaultScopes]"
$Scopes = if ($ScopesPrompt) { $ScopesPrompt } else { $DefaultScopes }

Write-Host
Write-Host "Choose the OAuth flow:" -ForegroundColor Yellow
Write-Host "1. Client Credentials (for bot-only functionality)" -ForegroundColor Yellow
Write-Host "2. Authorization Code (for acting on behalf of a user)" -ForegroundColor Yellow
$FlowChoice = Read-Host "Enter your choice (1 or 2)"

if ($FlowChoice -eq "1") {
    # Client credentials flow
    Write-Host
    Write-Host "Generating OAuth token..." -ForegroundColor Cyan
    
    $Body = @{
        client_id = $ClientId
        client_secret = $ClientSecret
        grant_type = "client_credentials"
        scope = $Scopes
    }
    
    try {
        $Response = Invoke-RestMethod -Uri "https://id.twitch.tv/oauth2/token" -Method Post -Body $Body -ContentType "application/x-www-form-urlencoded"
        
        Write-Host
        Write-Host "=== OAuth Token Generated Successfully ===" -ForegroundColor Green
        Write-Host "Access Token: $($Response.access_token)" -ForegroundColor Green
        Write-Host "Token Type: $($Response.token_type)" -ForegroundColor Green
        Write-Host "Expires In: $($Response.expires_in) seconds" -ForegroundColor Green
        
        # Save to .env file
        $SaveToEnv = Read-Host "Do you want to save this token to your .env file? (y/n)"
        
        if ($SaveToEnv -eq "y") {
            $EnvContent = ""
            if (Test-Path $EnvFile) {
                $EnvContent = Get-Content $EnvFile | Where-Object { -not $_.StartsWith("BOT_TOKEN=") }
            }
            
            $EnvContent += "BOT_TOKEN=$($Response.access_token)"
            Set-Content -Path $EnvFile -Value $EnvContent
            Write-Host "Token saved to .env file as BOT_TOKEN" -ForegroundColor Green
        }
        
        Write-Host
        Write-Host "For your bot configuration, use:" -ForegroundColor Yellow
        Write-Host "BOT_TOKEN=$($Response.access_token)" -ForegroundColor Yellow
    }
    catch {
        Write-Host "Error generating token:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
}
elseif ($FlowChoice -eq "2") {
    # Authorization code flow
    $RedirectUri = Read-Host "Enter your redirect URI (e.g. http://localhost:3000/auth/twitch/callback)"
    
    # Generate authorization URL
    $AuthUrl = "https://id.twitch.tv/oauth2/authorize?client_id=$ClientId&redirect_uri=$RedirectUri&response_type=code&scope=$($Scopes -replace ' ', '+')"
    
    Write-Host
    Write-Host "=== Authorization URL ===" -ForegroundColor Cyan
    Write-Host "Open this URL in your browser:" -ForegroundColor Cyan
    Write-Host $AuthUrl -ForegroundColor Yellow
    Write-Host
    Write-Host "After authorization, you will be redirected to your redirect URI with a code parameter."
    Write-Host "Extract this code and use it with the Twitch token endpoint to get your access token."
    
    $AuthCode = Read-Host "Enter the code from the redirect URL (or press Enter to skip)"
    
    if ($AuthCode) {
        Write-Host "Exchanging code for token..." -ForegroundColor Cyan
        
        $TokenBody = @{
            client_id = $ClientId
            client_secret = $ClientSecret
            code = $AuthCode
            grant_type = "authorization_code"
            redirect_uri = $RedirectUri
        }
        
        try {
            $TokenResponse = Invoke-RestMethod -Uri "https://id.twitch.tv/oauth2/token" -Method Post -Body $TokenBody -ContentType "application/x-www-form-urlencoded"
            
            Write-Host
            Write-Host "=== OAuth Token Generated Successfully ===" -ForegroundColor Green
            Write-Host "Access Token: $($TokenResponse.access_token)" -ForegroundColor Green
            Write-Host "Refresh Token: $($TokenResponse.refresh_token)" -ForegroundColor Green
            Write-Host "Token Type: $($TokenResponse.token_type)" -ForegroundColor Green
            Write-Host "Expires In: $($TokenResponse.expires_in) seconds" -ForegroundColor Green
            
            # Save to .env file
            $TokenSaveToEnv = Read-Host "Do you want to save this token to your .env file? (y/n)"
            
            if ($TokenSaveToEnv -eq "y") {
                $EnvContent = ""
                if (Test-Path $EnvFile) {
                    $EnvContent = Get-Content $EnvFile | Where-Object { -not $_.StartsWith("BOT_TOKEN=") }
                }
                
                $EnvContent += "BOT_TOKEN=$($TokenResponse.access_token)"
                Set-Content -Path $EnvFile -Value $EnvContent
                Write-Host "Token saved to .env file as BOT_TOKEN" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "Error exchanging code for token:" -ForegroundColor Red
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
    }
}
else {
    Write-Host "Invalid choice. Please run the script again and select 1 or 2." -ForegroundColor Red
}

Write-Host
Write-Host "Done!" -ForegroundColor Cyan 