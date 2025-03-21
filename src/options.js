
import { 
    getStoredAccessToken, 
    getTagSuggestionsEnabled, 
    getCurrentShortcut, 
    getPopupCloseInterval, 
    getDevModeEnabled, 
    getTabCacheEnabled,
    setTagSuggestionsEnabled,
    setPopupCloseInterval,
    setDevModeEnabled,
    setTabCacheEnabled,
    removeAccessToken
} from './localStorage.js';


// Format keyboard shortcut for display
function formatShortcut(shortcut) {
    if (!shortcut) return 'No shortcut set';
    return shortcut.split('+').map(key => {
        key = key.trim();
        if (key === 'Ctrl') return '⌘';
        if (key === 'Alt') return '⌥';
        if (key === 'Shift') return '⇧';
        return key;
    }).join(' + ');
}

// Update shortcut display
async function updateShortcutDisplay() {
    const currentShortcutDiv = document.getElementById('currentShortcut');
    const currentShortcut = await getCurrentShortcut();
    
    if (currentShortcut) {
        currentShortcutDiv.textContent = `Current shortcut: ${formatShortcut(currentShortcut)}`;
        currentShortcutDiv.style.color = '#1e7e34';
    } else {
        currentShortcutDiv.textContent = 'No shortcut set';
        currentShortcutDiv.style.color = '#666';
    }
}

// Update UI based on connection status
async function updateConnectionStatus() {
    const statusDiv = document.getElementById('connectionStatus');
    const connectButton = document.getElementById('connectButton');
    const tagSuggestionsToggle = document.getElementById('tagSuggestionsToggle');
    const token = await getStoredAccessToken();
    
    if (token) {
        statusDiv.textContent = 'Connected to Pocket';
        statusDiv.className = 'status connected';
        connectButton.textContent = 'Disconnect';
        connectButton.onclick = disconnectFromPocket;
        tagSuggestionsToggle.disabled = false;
    } else {
        statusDiv.textContent = 'Not connected';
        statusDiv.className = 'status disconnected';
        connectButton.textContent = 'Connect to Pocket';
        connectButton.onclick = connectToPocket;
        tagSuggestionsToggle.disabled = true;
        tagSuggestionsToggle.checked = false;
        await setTagSuggestionsEnabled(false);
    }
}

// Connect to Pocket
async function connectToPocket() {
    try {
        const connectButton = document.getElementById('connectButton');
        const statusDiv = document.getElementById('connectionStatus');
        connectButton.disabled = true;
        statusDiv.textContent = 'Connecting...';
        statusDiv.className = 'status disconnected';
        
        // Start auth flow through background script
        const response = await chrome.runtime.sendMessage({ type: 'START_AUTH' });
        
        if (!response.success) {
            throw new Error(response.error);
        }
        
        // Update UI
        updateConnectionStatus();
    } catch (error) {
        console.error('Error connecting to Pocket:', error);
        const statusDiv = document.getElementById('connectionStatus');
        statusDiv.textContent = `Connection failed: ${error.message}`;
        statusDiv.className = 'status disconnected';
        alert(`Failed to connect to Pocket: ${error.message}`);
    } finally {
        const connectButton = document.getElementById('connectButton');
        connectButton.disabled = false;
    }
}


// Initialize options page
document.addEventListener('DOMContentLoaded', async function() {
    // Setup tag suggestions toggle
    const tagSuggestionsToggle = document.getElementById('tagSuggestionsToggle');
    const tagSuggestionsStatus = document.getElementById('tagSuggestionsStatus');
    
    // Load saved preference
    const enabled = await getTagSuggestionsEnabled();
    tagSuggestionsToggle.checked = enabled;
    tagSuggestionsStatus.textContent = enabled ? 'Enabled' : 'Disabled';
    
    // Handle toggle change
    tagSuggestionsToggle.addEventListener('change', async function() {
        const enabled = this.checked;
        await setTagSuggestionsEnabled(enabled);
        tagSuggestionsStatus.textContent = enabled ? 'Enabled' : 'Disabled';
        
        // Request tag sync when enabled
        if (enabled) {
            chrome.runtime.sendMessage({ type: 'REQUEST_TAG_SYNC' }, response => {
                if (response && response.error) {
                    console.error('Failed to start tag sync:', response.error);
                    tagSuggestionsStatus.textContent = 'Sync failed';
                }
            });
        }
    });
    
    // Setup keyboard shortcut section
    const openShortcutsButton = document.getElementById('openShortcutsPage');
    const currentShortcutDiv = document.getElementById('currentShortcut');
    
    // Load current shortcut
    const currentShortcut = await getCurrentShortcut();
    currentShortcutDiv.textContent = formatShortcut(currentShortcut);
    
    // Handle opening shortcuts page
    openShortcutsButton.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
    
    // Check for shortcut changes every 2 seconds
    setInterval(updateShortcutDisplay, 2000);
    
    // Setup popup close interval
    const popupCloseInput = document.getElementById('popupCloseInterval');
    const popupCloseStatus = document.getElementById('popupCloseStatus');
    
    // Load saved interval
    const interval = await getPopupCloseInterval();
    popupCloseInput.value = interval;
    popupCloseStatus.textContent = `Popup will close ${interval} seconds after saving`;
    
    // Handle interval change
    popupCloseInput.addEventListener('change', async function() {
        const seconds = parseInt(this.value);
        if (isNaN(seconds) || seconds < 0 || seconds > 60) {
            popupCloseStatus.textContent = 'Please enter a number between 0 and 60';
            popupCloseStatus.className = 'shortcut-status error';
            return;
        }
        
        await setPopupCloseInterval(seconds);
        popupCloseStatus.textContent = `Popup will close ${seconds} seconds after saving`;
        popupCloseStatus.className = 'shortcut-status success';
    });
    
    // Initialize developer mode toggle
    const devModeToggle = document.getElementById('devModeToggle');
    const devModeStatus = document.getElementById('devModeStatus');
    
    devModeToggle.checked = await getDevModeEnabled();
    devModeStatus.textContent = devModeToggle.checked ? 'Enabled' : 'Disabled';
    
    devModeToggle.addEventListener('change', async () => {
        const enabled = devModeToggle.checked;
        await setDevModeEnabled(enabled);
        devModeStatus.textContent = enabled ? 'Enabled' : 'Disabled';
    });
    
    // Setup tab cache toggle
    const tabCacheToggle = document.getElementById('tabCacheToggle');
    const tabCacheStatus = document.getElementById('tabCacheStatus');
    
    // Load initial state
    const tabCacheEnabled = await getTabCacheEnabled();
    tabCacheToggle.checked = tabCacheEnabled;
    tabCacheStatus.textContent = tabCacheEnabled ? 'Enabled' : 'Disabled';
    
    // Handle toggle change
    tabCacheToggle.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        await setTabCacheEnabled(enabled);
        
        if (enabled) {
            // Trigger cache initialization when enabled
            chrome.runtime.sendMessage({ type: 'INITIALIZE_TAB_CACHE' });
        } else {
            // Clear cache when disabled
            await chrome.storage.local.remove([STORAGE_KEYS.TAB_CACHE]);
        }
    });
    
    // Update connection status
    updateConnectionStatus();
    
    // Listen for auth completion messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'AUTH_COMPLETE') {
            updateConnectionStatus();
        } else if (message.type === 'AUTH_ERROR') {
            const statusDiv = document.getElementById('connectionStatus');
            statusDiv.textContent = `Connection failed: ${message.error}`;
            statusDiv.className = 'status disconnected';
            alert(`Failed to connect to Pocket: ${message.error}`);
        }
    });
}); 

// Disconnect from Pocket
export async function disconnectFromPocket() {
    await removeAccessToken();
    updateConnectionStatus();
}