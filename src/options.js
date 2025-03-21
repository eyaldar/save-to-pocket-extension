// OAuth configuration
const POCKET_CONSUMER_KEY = '114159-ad4865edea00db98dbb760e';
const POCKET_REDIRECT_URI = chrome.identity.getRedirectURL();

// Storage keys
const STORAGE_KEYS = {
    TAGS: 'pocket_tags',
    TAGS_LAST_FETCH: 'pocket_tags_last_fetch',
    TAG_SUGGESTIONS_ENABLED: 'tag_suggestions_enabled',
    ACCESS_TOKEN: 'access_token',
    USERNAME: 'username',
    LAST_SYNC_OFFSET: 'pocket_last_sync_offset',
    KEYBOARD_SHORTCUT: 'keyboard_shortcut',
    DEV_MODE_ENABLED: 'dev_mode_enabled',
    TAB_CACHE_ENABLED: 'tab_cache_enabled'
};

// Get stored access token
async function getStoredAccessToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN], (result) => {
            resolve(result[STORAGE_KEYS.ACCESS_TOKEN]);
        });
    });
}

// Get stored tag suggestions preference
async function getTagSuggestionsEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED] ?? false);
        });
    });
}

// Store tag suggestions preference
async function setTagSuggestionsEnabled(enabled) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED]: enabled }, resolve);
    });
}

// Get stored keyboard shortcut
async function getStoredShortcut() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.KEYBOARD_SHORTCUT], (result) => {
            resolve(result[STORAGE_KEYS.KEYBOARD_SHORTCUT] || '');
        });
    });
}

// Store keyboard shortcut
async function storeShortcut(shortcut) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.KEYBOARD_SHORTCUT]: shortcut }, resolve);
    });
}

// Get current keyboard shortcut
async function getCurrentShortcut() {
    return new Promise((resolve) => {
        chrome.commands.getAll((commands) => {
            const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
            resolve(actionCommand?.shortcut || '');
        });
    });
}

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

// Disconnect from Pocket
async function disconnectFromPocket() {
    await chrome.storage.local.remove([STORAGE_KEYS.ACCESS_TOKEN]);
    updateConnectionStatus();
}

// Get stored popup close interval
async function getPopupCloseInterval() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['popup_close_interval'], (result) => {
            resolve(result.popup_close_interval ?? 3); // Default to 3 seconds
        });
    });
}

// Store popup close interval
async function setPopupCloseInterval(seconds) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ popup_close_interval: seconds }, resolve);
    });
}

// Get developer mode status
async function getDevModeEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.DEV_MODE_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.DEV_MODE_ENABLED] ?? false);
        });
    });
}

// Store developer mode status
async function setDevModeEnabled(enabled) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.DEV_MODE_ENABLED]: enabled }, resolve);
    });
}

// Get tab cache enabled preference
async function getTabCacheEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAB_CACHE_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.TAB_CACHE_ENABLED] ?? false);
        });
    });
}

// Store tab cache enabled preference
async function setTabCacheEnabled(enabled) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE_ENABLED]: enabled }, resolve);
    });
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