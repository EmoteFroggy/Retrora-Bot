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
    // Check authentication status
    const response = await fetch(`${API_BASE_URL}/auth/status`, {
      credentials: 'include'
    });
    const data = await response.json();
    
    if (data.isAuthenticated) {
      currentUser = data.user;
      showDashboard();
    } else {
      showHome();
    }
  } catch (error) {
    console.error('Error initializing app:', error);
    showHome();
  }
}

// Show home page
function showHome() {
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

// Show dashboard
function showDashboard() {
  homeSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  
  // Set auth section with user info
  authSection.innerHTML = `
    <div class="flex items-center">
      <img src="${currentUser.profileImage || 'https://placehold.co/30x30'}" alt="${currentUser.displayName}" class="w-8 h-8 rounded-full mr-2">
      <span class="mr-4">${currentUser.displayName}</span>
      <a href="${API_BASE_URL}/auth/logout" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded">
        Logout
      </a>
    </div>
  `;
  
  // Check if user has access to any channel
  if (currentUser.moderatedChannels && currentUser.moderatedChannels.length > 0) {
    // Load commands for the target channel
    currentChannel = currentUser.moderatedChannels[0];
    loadCommands(currentChannel);
  } else {
    // No moderation privileges
    document.querySelector('#dashboard-section h2').textContent = 'No Access';
    commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center">You do not have permission to edit commands for this channel. Only moderators can edit commands.</td></tr>';
    
    // Hide add command button
    if (addCommandBtn) {
      addCommandBtn.style.display = 'none';
    }
  }
}

// Load commands for a channel
async function loadCommands(channel) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/commands/${channel}`, {
      credentials: 'include'
    });
    
    if (response.status === 403) {
      commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center">You are not authorized to view commands for this channel</td></tr>';
      return;
    }
    
    commands = await response.json();
    renderCommands();
  } catch (error) {
    console.error('Error loading commands:', error);
    commandsTableBody.innerHTML = '<tr><td colspan="6" class="px-4 py-2 text-center">Error loading commands</td></tr>';
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
    let response;
    
    if (editingCommandId) {
      // Update existing command
      response = await fetch(`${API_BASE_URL}/api/commands/${currentChannel}/${editingCommandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
        credentials: 'include'
      });
    } else {
      // Create new command
      response = await fetch(`${API_BASE_URL}/api/commands/${currentChannel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData),
        credentials: 'include'
      });
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
    const response = await fetch(`${API_BASE_URL}/api/commands/${currentChannel}/${commandId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  init();
  
  if (addCommandBtn) {
    addCommandBtn.addEventListener('click', openAddModal);
  }
  
  if (cancelCommandBtn) {
    cancelCommandBtn.addEventListener('click', closeModal);
  }
  
  if (commandForm) {
    commandForm.addEventListener('submit', saveCommand);
  }
}); 