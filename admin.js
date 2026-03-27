// GitHub Configuration
const GITHUB_TOKEN = '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';
const GITHUB_OWNER = 'BitaKura';
const GITHUB_REPO = 'admin-panel';
const BRANCH = 'main';
const KEY_FILE_PATH = 'Key.json';
const CONTROL_FILE_PATH = 'control.json';

const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;
const KEY_FILE_URL = `${GITHUB_API}/${KEY_FILE_PATH}`;
const CONTROL_FILE_URL = `${GITHUB_API}/${CONTROL_FILE_PATH}`;

let currentKeyData = null;
let currentControlData = null;

// Helper function to add log message
function addLog(message) {
    const logDiv = document.getElementById('statusLog');
    const timestamp = new Date().toLocaleTimeString();
    logDiv.innerHTML += `[${timestamp}] ${message}\n`;
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(message);
}

// Helper function to get file SHA from GitHub
async function getFileSHA(fileUrl) {
    try {
        const response = await fetch(`${fileUrl}?ref=${BRANCH}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch (error) {
        addLog(`Error getting SHA: ${error.message}`);
    }
    return null;
}

// Load Key.json from GitHub
async function loadKeyData() {
    try {
        addLog('Loading Key.json from GitHub...');
        const response = await fetch(`${KEY_FILE_URL}?ref=${BRANCH}&t=${Date.now()}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const decodedContent = atob(data.content);
        currentKeyData = JSON.parse(decodedContent);
        
        // Ensure required structures exist
        if (!currentKeyData.users) currentKeyData.users = [];
        if (!currentKeyData.announcements) currentKeyData.announcements = [];
        
        addLog(`✅ Loaded ${currentKeyData.users.length} accounts, ${currentKeyData.announcements.length} announcements`);
        updateUI();
        
    } catch (error) {
        addLog(`❌ Error loading Key.json: ${error.message}`);
        // Initialize empty structure
        currentKeyData = { enabled: true, users: [], announcements: [] };
        updateUI();
    }
}

// Load control.json from GitHub
async function loadControlData() {
    try {
        addLog('Loading control.json from GitHub...');
        const response = await fetch(`${CONTROL_FILE_URL}?ref=${BRANCH}&t=${Date.now()}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        const decodedContent = atob(data.content);
        currentControlData = JSON.parse(decodedContent);
        
        // Update checkbox and fields
        document.getElementById('toolEnabled').checked = currentControlData.enabled !== false;
        document.getElementById('statusMessage').value = currentControlData.message || '';
        document.getElementById('broadcastMessage').value = currentControlData.broadcast || '';
        
        addLog(`✅ Tool status: ${currentControlData.enabled ? 'ENABLED' : 'DISABLED'}`);
        
    } catch (error) {
        addLog(`❌ Error loading control.json: ${error.message}`);
        // Initialize default structure
        currentControlData = { enabled: true, message: '', broadcast: '' };
    }
}

// Update entire UI
function updateUI() {
    if (!currentKeyData) return;
    
    // Update stats
    const totalAccounts = currentKeyData.users.length;
    let totalDevices = 0;
    let onlineNow = 0;
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    currentKeyData.users.forEach(user => {
        if (user.devices) {
            totalDevices += user.devices.length;
            user.devices.forEach(device => {
                if (device.last_heartbeat && device.last_heartbeat > fiveMinutesAgo) {
                    onlineNow++;
                }
            });
        }
    });
    
    document.getElementById('totalAccounts').textContent = totalAccounts;
    document.getElementById('totalDevices').textContent = totalDevices;
    document.getElementById('onlineNow').textContent = onlineNow;
    document.getElementById('totalAnnouncements').textContent = currentKeyData.announcements.length;
    document.getElementById('accountCount').textContent = totalAccounts;
    document.getElementById('onlineCount').textContent = onlineNow;
    
    // Update accounts table
    updateAccountsTable();
    
    // Update announcements list
    updateAnnouncementsList();
    
    // Update JSON preview
    document.getElementById('jsonPreview').textContent = JSON.stringify(currentKeyData, null, 2);
}

// Update accounts table
function updateAccountsTable() {
    const tbody = document.getElementById('accountsBody');
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    if (!currentKeyData.users || currentKeyData.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No accounts found</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    currentKeyData.users.forEach((user, index) => {
        const row = tbody.insertRow();
        const devices = user.devices || [];
        const onlineDevices = devices.filter(d => d.last_heartbeat && d.last_heartbeat > fiveMinutesAgo);
        const isOnline = onlineDevices.length > 0;
        
        row.innerHTML = `
            <td>${escapeHtml(user.username)}</td>
            <td>${user.type || 'user'}</td>
            <td>${user.access_type || 'single'}</td>
            <td>${user.expiry_display || 'Never'}</td>
            <td>${devices.length}</td>
            <td class="${isOnline ? 'online' : 'offline'}">${isOnline ? '● Online' : '○ Offline'}</td>
            <td>
                <button onclick="deleteAccount(${index})" class="danger" style="padding: 5px 10px;">Delete</button>
                <button onclick="viewDevices(${index})" style="padding: 5px 10px;">Devices</button>
            </td>
        `;
    });
}

// Update announcements list
function updateAnnouncementsList() {
    const container = document.getElementById('announcementsList');
    
    if (!currentKeyData.announcements || currentKeyData.announcements.length === 0) {
        container.innerHTML = '<p>No announcements yet. Send one above!</p>';
        return;
    }
    
    let html = '<table><thead><tr><th>Date</th><th>Title</th><th>Message</th><th>Priority</th><th>Actions</th></tr></thead><tbody>';
    
    currentKeyData.announcements.slice().reverse().forEach((ann, idx) => {
        const date = new Date(ann.timestamp).toLocaleString();
        html += `
            <tr>
                <td>${date}</td>
                <td><strong>${escapeHtml(ann.title)}</strong></td>
                <td>${escapeHtml(ann.message)}</td>
                <td>${ann.priority || 'normal'}</td>
                <td><button onclick="deleteAnnouncement(${idx})" class="danger" style="padding: 5px 10px;">Delete</button></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

// Save Key.json to GitHub
async function saveToGitHub() {
    try {
        addLog('Saving to GitHub...');
        document.getElementById('saveStatus').textContent = 'Saving...';
        
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(currentKeyData, null, 4))));
        const sha = await getFileSHA(KEY_FILE_URL);
        
        const body = {
            message: `Admin panel update - ${new Date().toLocaleString()}`,
            content: content,
            branch: BRANCH
        };
        
        if (sha) body.sha = sha;
        
        const response = await fetch(KEY_FILE_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        addLog('✅ Saved successfully to GitHub!');
        document.getElementById('saveStatus').textContent = '✓ Saved!';
        setTimeout(() => {
            document.getElementById('saveStatus').textContent = '';
        }, 3000);
        
    } catch (error) {
        addLog(`❌ Save failed: ${error.message}`);
        document.getElementById('saveStatus').textContent = '✗ Save failed';
    }
}

// Send push notification
function sendPushNotification() {
    const title = document.getElementById('announcementTitle').value.trim();
    const message = document.getElementById('announcementMessage').value.trim();
    const priority = document.getElementById('announcementPriority').value;
    const type = document.getElementById('announcementType').value;
    
    if (!title || !message) {
        alert('Please enter both title and message');
        return;
    }
    
    const announcement = {
        id: 'ann_' + Date.now(),
        title: title,
        message: message,
        type: type,
        priority: priority,
        timestamp: Date.now()
    };
    
    if (!currentKeyData.announcements) currentKeyData.announcements = [];
    currentKeyData.announcements.push(announcement);
    
    // Clear form
    document.getElementById('announcementTitle').value = '';
    document.getElementById('announcementMessage').value = '';
    
    addLog(`📢 Added announcement: ${title}`);
    updateUI();
    saveToGitHub();
}

// Update tool status
async function updateToolStatus() {
    const enabled = document.getElementById('toolEnabled').checked;
    const message = document.getElementById('statusMessage').value;
    const broadcast = document.getElementById('broadcastMessage').value;
    
    currentControlData = {
        enabled: enabled,
        message: message,
        broadcast: broadcast
    };
    
    try {
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(currentControlData, null, 4))));
        const sha = await getFileSHA(CONTROL_FILE_URL);
        
        const body = {
            message: `Tool status update: ${enabled ? 'ENABLED' : 'DISABLED'}`,
            content: content,
            branch: BRANCH
        };
        
        if (sha) body.sha = sha;
        
        const response = await fetch(CONTROL_FILE_URL, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        addLog(`✅ Tool status updated: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        
    } catch (error) {
        addLog(`❌ Failed to update tool status: ${error.message}`);
    }
}

// Add new account
function addNewAccount() {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const userType = document.getElementById('newUserType').value;
    const accessType = document.getElementById('newAccessType').value;
    const expiryDate = document.getElementById('newExpiryDate').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    // Check if username exists
    if (currentKeyData.users.some(u => u.username === username)) {
        alert('Username already exists!');
        return;
    }
    
    let expiryTimestamp = 0;
    let expiryDisplay = 'Never';
    
    if (expiryDate) {
        expiryTimestamp = new Date(expiryDate).getTime();
        expiryDisplay = expiryDate;
    }
    
    const newUser = {
        username: username,
        password: password,
        type: userType,
        access_type: accessType,
        expiry_display: expiryDisplay,
        expiry_timestamp: expiryTimestamp,
        devices: []
    };
    
    currentKeyData.users.push(newUser);
    
    // Clear form
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newExpiryDate').value = '';
    
    addLog(`➕ Added new account: ${username} (${accessType})`);
    updateUI();
    saveToGitHub();
}

// Delete account
function deleteAccount(index) {
    if (confirm(`Delete account "${currentKeyData.users[index].username}"?`)) {
        const username = currentKeyData.users[index].username;
        currentKeyData.users.splice(index, 1);
        addLog(`🗑️ Deleted account: ${username}`);
        updateUI();
        saveToGitHub();
    }
}

// View devices
function viewDevices(index) {
    const user = currentKeyData.users[index];
    if (!user.devices || user.devices.length === 0) {
        alert(`No devices registered for ${user.username}`);
        return;
    }
    
    let deviceList = `Devices for ${user.username}:\n\n`;
    user.devices.forEach((device, i) => {
        const lastHeartbeat = device.last_heartbeat ? new Date(device.last_heartbeat).toLocaleString() : 'Never';
        deviceList += `${i+1}. ${device.device_name}\n`;
        deviceList += `   ID: ${device.device_id}\n`;
        deviceList += `   Model: ${device.manufacturer} ${device.model}\n`;
        deviceList += `   Android: ${device.android_version}\n`;
        deviceList += `   Carrier: ${device.carrier_name || 'Unknown'}\n`;
        deviceList += `   Network: ${device.network_type || 'Unknown'}\n`;
        deviceList += `   Last Heartbeat: ${lastHeartbeat}\n\n`;
    });
    
    alert(deviceList);
}

// Delete announcement
function deleteAnnouncement(index) {
    const realIndex = currentKeyData.announcements.length - 1 - index;
    if (confirm('Delete this announcement?')) {
        currentKeyData.announcements.splice(realIndex, 1);
        addLog(`🗑️ Deleted announcement`);
        updateUI();
        saveToGitHub();
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
async function init() {
    addLog('🔧 Kura Tool Admin Panel v2.0 (GitHub Edition)');
    addLog('Loading data from GitHub...');
    await loadKeyData();
    await loadControlData();
    addLog('✅ Admin panel ready!');
}

// Auto-refresh every 30 seconds
setInterval(() => {
    loadKeyData();
    loadControlData();
}, 30000);

// Start
init();