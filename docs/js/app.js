// Twitch Bot Dashboard Frontend (GitHub Pages Version)

// API Base URL - Change this to your Vercel deployment URL
const API_BASE_URL = "https://retrora-bot.vercel.app";

// DOM Elements
const authSection = document.getElementById('auth-section');
const homeSection = document.getElementById('home-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginButton = document.getElementById('login-button');
const commandsTableBody = document.getElementById('commands-table-body');
const addCommandBtn = document.getElementById('add-command-btn');
const commandModal = document.getElementById('command-modal');
const modalTitle = document.getElementById('modal-title');
const commandForm = document.getElementById('command-form');
const commandNameInput = document.getElementById('command-name');
const commandResponseInput = document.getElementById('command-response');
const commandCooldownInput = document.getElementById('command-cooldown');
const commandUserLevelInput = document.getElementById('command-user-level');
const cancelCommandBtn = document.getElementById('cancel-command-btn');

// State
let currentUser = null;
let currentChannel = null;
let commands = [];
let editingCommandId = null;

// Initialize the app
async function init() {
  try {
    // Show loading
    showLoading();
    
    // Check URL parameters for authentication status
    const params = new URLSearchParams(window.location.search);
    const loggedIn = params.get('loggedIn');
    const userId = params.get('userId');
    const authToken = params.get('authToken');
    
    console.log('URL Params:', { loggedIn, userId, hasAuthToken: !!authToken });
    
    // If URL contains login params with auth token, store them in localStorage and clean up URL
    if (loggedIn === 'true' && userId && authToken) {
      console.log('User logged in via URL params with auth token, storing in localStorage');
      localStorage.setItem('twitchBotAuth', JSON.stringify({
        loggedIn: true,
        userId: userId,
        authToken: authToken,
        timestamp: Date.now()
      }));
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Check localStorage for saved authentication
    const savedAuth = localStorage.getItem('twitchBotAuth');
    if (savedAuth) {
      const authData = JSON.parse(savedAuth);
      console.log('Found saved auth in localStorage:', { 
        userId: authData.userId, 
        hasAuthToken: !!authData.authToken,
        timestamp: new Date(authData.timestamp).toLocaleString()
      });
      
      // Check if saved auth is fresh (less than 1 hour old - Twitch tokens expire) and has auth token
      const isAuthFresh = Date.now() - authData.timestamp < 60 * 60 * 1000;
      if (authData.loggedIn && authData.userId && authData.authToken && isAuthFresh) {
        console.log('Using saved authentication with token');
        try {
          // Verify the token is still valid by fetching user data
          const response = await fetch(`${API_BASE_URL}/api/verify-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authData.authToken}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            currentUser = userData;
            console.log('User verified with valid token:', currentUser.displayName);
            showDashboard();
            return;
          } else {
            console.error('Token verification failed, status:', response.status);
            localStorage.removeItem('twitchBotAuth');
            showHome();
            return;
          }
        } catch (error) {
          console.error('Error verifying token:', error);
          localStorage.removeItem('twitchBotAuth');
          showHome();
          return;
        }
      } else {
        console.log('Saved auth is expired or invalid, clearing localStorage');
        localStorage.removeItem('twitchBotAuth');
      }
    }
    
    // If we get here, we're not authenticated
    console.log('No valid authentication found, showing login screen');
    showHome();
    
  } catch (error) {
    console.error('Error initializing app:', error);
    showError('Failed to initialize the application. Please try again later.');
  }
}

// Show home page
function showHome() {
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById('error-section').classList.add('hidden');
  homeSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  
  // Set auth section
  authSection.innerHTML = `
    <a href="${API_BASE_URL}/auth/twitch" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded btn-twitch">
      Login
    </a>
  `;
  
  // Set login button
  loginButton.innerHTML = `
    <a href="${API_BASE_URL}/auth/twitch" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg text-lg transition duration-300">
      Login with Twitch
    </a>
  `;
}

// Logout function
function logout() {
  console.log('Logging out');
  
  // Clear localStorage
  localStorage.removeItem('twitchBotAuth');
  
  // Redirect to home/login page
  window.location.href = window.location.pathname;
}

// Show dashboard
function showDashboard() {
  document.getElementById('loading-section').classList.add('hidden');
  document.getElementById('error-section').classList.add('hidden');
  homeSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  
  console.log('Showing dashboard with user:', currentUser);
  
  // Set auth section with user info
  authSection.innerHTML = `
    <div class="flex items-center">
      <img src="${currentUser.profileImage || 'https://placehold.co/30x30'}" alt="${currentUser.displayName}" class="w-8 h-8 rounded-full mr-2">
      <div class="mr-4">
        <div class="flex items-center">
          <span>${currentUser.displayName}</span>
          ${currentUser.isAdmin ? '<span class="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded">Admin</span>' : ''}
        </div>
        <div class="text-xs text-gray-400">${currentUser.login || ''}</div>
      </div>
      <button onclick="logout()" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
        Logout
      </button>
    </div>
  `;
  
  // Always update the channel name
  const channelName = currentUser.moderatedChannels && currentUser.moderatedChannels[0] 
    ? currentUser.moderatedChannels[0] 
    : process.env.CHANNEL_NAME || 'your channel';
  
  document.querySelector('#dashboard-section h2').textContent = `Commands for ${channelName}`;
  
  // Check if user has access to any channel
  if (currentUser.moderatedChannels && currentUser.moderatedChannels.length > 0) {
    // Show add command button
    if (addCommandBtn) {
      addCommandBtn.style.display = 'block';
    }
    
    // Load commands for the target channel
    currentChannel = currentUser.moderatedChannels[0];
    loadCommands(currentChannel);
  } else {
    // No moderation privileges
    commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center text-yellow-400">You do not have permission to edit commands for this channel. Only moderators can edit commands.</td></tr>';
    
    // Hide add command button
    if (addCommandBtn) {
      addCommandBtn.style.display = 'none';
    }
  }
}

// Load commands for a channel
async function loadCommands(channel) {
  try {
    commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center">Loading commands...</td></tr>';
    
    console.log(`Loading commands for channel: ${channel}`);
    
    // Get auth token from localStorage
    const savedAuth = localStorage.getItem('twitchBotAuth');
    if (!savedAuth) {
      console.error('No auth data found in localStorage');
      commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center text-red-400">Authentication required. Please log in again.</td></tr>';
      
      // Show login button
      const loginRow = document.createElement('tr');
      loginRow.innerHTML = `<td colspan="6" class="px-4 py-2 text-center">
        <a href="${API_BASE_URL}/auth/twitch" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          Login with Twitch
        </a>
      </td>`;
      commandsTableBody.appendChild(loginRow);
      return;
    }
    
    const authData = JSON.parse(savedAuth);
    if (!authData.authToken) {
      console.error('No auth token found in saved auth data');
      localStorage.removeItem('twitchBotAuth');
      commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center text-red-400">Invalid authentication. Please log in again.</td></tr>';
      
      // Show login button
      const loginRow = document.createElement('tr');
      loginRow.innerHTML = `<td colspan="6" class="px-4 py-2 text-center">
        <a href="${API_BASE_URL}/auth/twitch" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          Login with Twitch
        </a>
      </td>`;
      commandsTableBody.appendChild(loginRow);
      return;
    }
    
    // Use Authorization header with bearer token
    const response = await fetch(`${API_BASE_URL}/api/commands/${channel}`, {
      headers: {
        'Authorization': `Bearer ${authData.authToken}`
      }
    });
    
    if (response.status === 401) {
      console.error('Authentication failed (401 Unauthorized)');
      localStorage.removeItem('twitchBotAuth'); // Clear invalid auth
      commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center text-red-400">Your session has expired. Please log in again.</td></tr>';
      
      // Show login button
      const loginRow = document.createElement('tr');
      loginRow.innerHTML = `<td colspan="6" class="px-4 py-2 text-center">
        <a href="${API_BASE_URL}/auth/twitch" class="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded">
          Login with Twitch
        </a>
      </td>`;
      commandsTableBody.appendChild(loginRow);
      return;
    }
    
    if (response.status === 403) {
      commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center text-yellow-400">You are not authorized to view commands for this channel</td></tr>';
      return;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error loading commands: ${response.status} - ${errorText}`);
      commandsTableBody.innerHTML = `<tr><td colspan="6" class="px-4 py-2 text-center text-red-400">Error loading commands: ${response.status}</td></tr>`;
      return;
    }
    
    commands = await response.json();
    console.log(`Loaded ${commands.length} commands`);
    renderCommands();
  } catch (error) {
    console.error('Error loading commands:', error);
    commandsTableBody.innerHTML = `<tr><td colspan="6" class="px-4 py-2 text-center text-red-400">Error loading commands: ${error.message}</td></tr>`;
  }
}

// Render commands table
function renderCommands() {
  if (commands.length === 0) {
    commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center">No commands found</td></tr>';
    return;
  }
  
  commandsTableBody.innerHTML = '';
  
  commands.forEach(command => {
    const row = document.createElement('tr');
    row.className = 'commands-table';
    
    row.innerHTML = `
      <td class="px-4 py-2 font-mono">!${command.name}</td>
      <td class="px-4 py-2">${command.response}</td>
      <td class="px-4 py-2 text-center">${command.cooldown}s</td>
      <td class="px-4 py-2 text-center capitalize">${command.userLevel}</td>
      <td class="px-4 py-2 text-center">
        <span class="inline-block w-3 h-3 rounded-full ${command.enabled ? 'bg-green-500' : 'bg-red-500'}"></span>
        <span class="ml-1">${command.enabled ? 'Enabled' : 'Disabled'}</span>
      </td>
      <td class="px-4 py-2 text-center">
        <button class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded mr-1 edit-btn" data-id="${command._id}">
          Edit
        </button>
        <button class="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded delete-btn" data-id="${command._id}">
          Delete
        </button>
      </td>
    `;
    
    commandsTableBody.appendChild(row);
  });
  
  // Add event listeners to buttons
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCommand(btn.dataset.id));
  });
}

// Open modal to add a new command
function openAddModal() {
  modalTitle.textContent = 'Add Command';
  commandNameInput.value = '';
  commandResponseInput.value = '';
  commandCooldownInput.value = '5';
  commandUserLevelInput.value = 'everyone';
  editingCommandId = null;
  commandModal.classList.remove('hidden');
}

// Open modal to edit a command
function openEditModal(commandId) {
  const command = commands.find(cmd => cmd._id === commandId);
  if (!command) return;
  
  modalTitle.textContent = 'Edit Command';
  commandNameInput.value = command.name;
  commandResponseInput.value = command.response;
  commandCooldownInput.value = command.cooldown;
  commandUserLevelInput.value = command.userLevel;
  editingCommandId = commandId;
  commandModal.classList.remove('hidden');
}

// Close the command modal
function closeModal() {
  commandModal.classList.add('hidden');
}

// Save a command (create or update)
async function saveCommand(event) {
  event.preventDefault();
  
  const commandData = {
    name: commandNameInput.value.trim().replace(/^!/, ''),
    response: commandResponseInput.value.trim(),
    cooldown: parseInt(commandCooldownInput.value),
    userLevel: commandUserLevelInput.value
  };
  
  // Validate input
  if (!commandData.name || !commandData.response) {
    alert('Command name and response are required');
    return;
  }
  
  try {
    // Get auth token from localStorage
    const savedAuth = localStorage.getItem('twitchBotAuth');
    if (!savedAuth) {
      alert('Authentication required. Please log in again.');
      return;
    }
    
    const authData = JSON.parse(savedAuth);
    if (!authData.authToken) {
      console.error('No auth token found in saved auth data');
      localStorage.removeItem('twitchBotAuth');
      alert('Invalid authentication. Please log in again.');
      return;
    }
    
    const authHeader = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.authToken}`
    };
    
    let response;
    
    if (editingCommandId) {
      // Update existing command
      response = await fetch(`${API_BASE_URL}/api/commands/${currentChannel}/${editingCommandId}`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify(commandData)
      });
    } else {
      // Create new command
      response = await fetch(`${API_BASE_URL}/api/commands/${currentChannel}`, {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify(commandData)
      });
    }
    
    if (response.status === 401) {
      alert('Your session has expired. Please log in again.');
      localStorage.removeItem('twitchBotAuth'); // Clear invalid auth
      return;
    }
    
    if (response.ok) {
      closeModal();
      loadCommands(currentChannel);
    } else {
      const error = await response.json();
      alert(`Error: ${error.error || 'Failed to save command'}`);
    }
  } catch (error) {
    console.error('Error saving command:', error);
    alert('Failed to save command');
  }
}

// Delete a command
async function deleteCommand(commandId) {
  if (!confirm('Are you sure you want to delete this command?')) return;
  
  try {
    // Get auth token from localStorage
    const savedAuth = localStorage.getItem('twitchBotAuth');
    if (!savedAuth) {
      alert('Authentication required. Please log in again.');
      return;
    }
    
    const authData = JSON.parse(savedAuth);
    if (!authData.authToken) {
      console.error('No auth token found in saved auth data');
      localStorage.removeItem('twitchBotAuth');
      alert('Invalid authentication. Please log in again.');
      return;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/commands/${currentChannel}/${commandId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authData.authToken}`
      }
    });
    
    if (response.status === 401) {
      alert('Your session has expired. Please log in again.');
      localStorage.removeItem('twitchBotAuth'); // Clear invalid auth
      return;
    }
    
    if (response.ok) {
      loadCommands(currentChannel);
    } else {
      const error = await response.json();
      alert(`Error: ${error.error || 'Failed to delete command'}`);
    }
  } catch (error) {
    console.error('Error deleting command:', error);
    alert('Failed to delete command');
  }
}

// Show loading screen
function showLoading() {
  homeSection.classList.add('hidden');
  dashboardSection.classList.add('hidden');
  document.getElementById('error-section').classList.add('hidden');
  document.getElementById('loading-section').classList.remove('hidden');
}

// Show error message
function showError(message) {
  homeSection.classList.add('hidden');
  dashboardSection.classList.add('hidden');
  document.getElementById('loading-section').classList.add('hidden');
  
  const errorSection = document.getElementById('error-section');
  errorSection.classList.remove('hidden');
  
  const errorMessage = document.getElementById('error-message');
  errorMessage.textContent = message || 'An error occurred. Please try again.';
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('Document loaded - initializing app');
  
  // Initialize app
  init();
  
  // Command form event listeners
  addCommandBtn?.addEventListener('click', openAddModal);
  cancelCommandBtn?.addEventListener('click', closeModal);
  commandForm?.addEventListener('submit', saveCommand);
  
  // Retry button
  document.getElementById('retry-button')?.addEventListener('click', init);
}); 