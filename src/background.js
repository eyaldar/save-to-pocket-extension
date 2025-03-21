
import { 
    CACHE_DURATION,
    MAX_CALLS_PER_HOUR,
    RATE_LIMIT_WINDOW,
    MIN_SYNC_INTERVAL 
} from './constants.js';
import { 
    getStoredAccessToken, 
    getStoredTags, 
    getTagSuggestionsEnabled, 
    getTabCacheEnabled, 
    storeTags, 
    storeTabCache,
    getTabCache,
    setAccessToken,
    getKeyboardShortcut,
    removeKeyboardShortcut
} from './localStorage.js';
import { 
    fetchAllTagsWithToken, 
    getAccessToken, 
    handleAuthRequest, 
    checkPocketItemStatus
} from './pocketApi.js';

// Message handler for authorization requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_AUTH') {
        handleAuthRequest(sender, sendResponse);
        return true; // Will respond asynchronously
    }
});

// Flag to track if sync is in progress
let isSyncing = false;

// Track API calls for rate limiting
let apiCallTimestamps = [];

// Check if we're within rate limits
function isWithinRateLimit() {
    const now = Date.now();
    // Remove timestamps older than 1 hour
    apiCallTimestamps = apiCallTimestamps.filter(timestamp => 
        now - timestamp < RATE_LIMIT_WINDOW
    );
    
    // Check if we've made less than 20 calls in the last hour
    return apiCallTimestamps.length < MAX_CALLS_PER_HOUR;
}

// Record an API call
function recordApiCall() {
    apiCallTimestamps.push(Date.now());
}

// Initialize service worker
async function initializeServiceWorker() {
    console.log('Initializing service worker...');
    
    // Update keyboard shortcut and tooltip
    await updateKeyboardShortcut();
    
    // Check if we need to sync tags
    const enabled = await getTagSuggestionsEnabled();
    if (enabled) {
        console.log('Tag suggestions are enabled, starting initial tag sync');
        syncTags();
    } else {
        console.log('Tag suggestions are disabled, skipping initial sync');
    }

    // Initialize tab cache
    console.log('[Background] Starting tab cache initialization...');
    await initializeTabCache();

    try {
        // Set up periodic cache invalidation (every 5 hours)
        setInterval(async () => {
            console.log('Running periodic cache invalidation...');
            const cache = await getTabCache();
            const now = Date.now();
            let hasInvalidEntries = false;
            
            // Check each cache entry
            for (const [url, entry] of Object.entries(cache)) {
                if (now - entry.timestamp > CACHE_DURATION) {
                    console.log('Invalidating cache entry for:', url);
                    delete cache[url];
                    hasInvalidEntries = true;
                }
            }
            
            // Update cache if any entries were invalidated
            if (hasInvalidEntries) {
                await storeTabCache(cache);
                console.log('Cache updated after invalidation');
            }
        }, CACHE_DURATION);
        
        // Set up periodic tag sync with rate limiting
        setInterval(async () => {
            if (await shouldSyncTags() && isWithinRateLimit()) {
                await syncTags();
            }
        }, MIN_SYNC_INTERVAL); // Check every 3 minutes (20 calls per hour)
    } catch (error) {
        console.error('Error initializing service worker:', error);
    }
}


// Initialize tab cache
async function initializeTabCache() {
    console.log('[Background] Starting tab cache initialization...');
    try {
        // Check if tab cache is enabled
        const enabled = await getTabCacheEnabled();
        if (!enabled) {
            console.log('[Background] Tab cache is disabled, skipping initialization');
            return;
        }

        const tabs = await chrome.tabs.query({});
        console.log('[Background] Found tabs to cache:', tabs.length);
        
        const cache = {};
        for (const tab of tabs) {
            if (tab.url && !tab.url.startsWith('chrome://')) {
                console.log('[Background] Caching tab:', tab.url);
                const accessToken = await getStoredAccessToken();
                let pocketStatus = null;
                
                if (accessToken) {
                    pocketStatus = await checkPocketItemStatus(accessToken, tab.url);
                }
                
                cache[tab.url] = {
                    url: tab.url,
                    title: tab.title,
                    pocketStatus: pocketStatus,
                    timestamp: Date.now()
                };
            }
        }
        
        await storeTabCache(cache);
        console.log('[Background] Tab cache initialization complete');
    } catch (error) {
        console.error('[Background] Error initializing tab cache:', error);
    }
}

// Update tab in cache
async function updateTabInCache(tab) {
    console.log('[Background] Updating tab in cache:', tab.url);
    try {
        // Check if tab cache is enabled
        const enabled = await getTabCacheEnabled();
        if (!enabled) {
            console.log('[Background] Tab cache is disabled, skipping update');
            return;
        }

        const cache = await getTabCache();
        const accessToken = await getStoredAccessToken();
        let pocketStatus = null;
        
        if (accessToken) {
            pocketStatus = await checkPocketItemStatus(accessToken, tab.url);
        }
        
        cache[tab.url] = {
            url: tab.url,
            title: tab.title,
            pocketStatus: pocketStatus,
            timestamp: Date.now()
        };
        
        await storeTabCache(cache);
        console.log('[Background] Tab cache updated successfully');
    } catch (error) {
        console.error('[Background] Error updating tab in cache:', error);
    }
}

// Remove tab from cache when it's closed
chrome.tabs.onRemoved.addListener(async (tabId) => {
    console.log('[Background] Tab closed:', tabId);
    try {
        // Check if tab cache is enabled
        const enabled = await getTabCacheEnabled();
        if (!enabled) {
            console.log('[Background] Tab cache is disabled, skipping removal');
            return;
        }

        // Get the tab cache
        const cache = await getTabCache();

        // Get the tab URL before it's removed
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab || !tab.url) {
            console.log('[Background] No URL found for closed tab:', tabId);
            return;
        }

        console.log('[Background] Removing tab from cache:', tab.url);
        
        // Remove the tab from cache using URL as key
        const updatedCache = { ...cache };
        delete updatedCache[tab.url];
        
        // Update the cache
        await storeTabCache(updatedCache);
        console.log('[Background] Tab removed from cache successfully');
    } catch (error) {
        console.error('[Background] Error removing tab from cache:', error);
    }
});

// Tab event handlers
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    console.log('[Background] Tab update event:', {
        tabId,
        changeInfo,
        url: tab.url,
        title: tab.title
    });

    // Handle OAuth redirect
    if (tab.url && tab.url.includes('getpocket.com/auth/authorize')) {
        console.log('[Background] Handling OAuth redirect');
        try {
            const requestToken = await getStoredRequestToken();
            if (!requestToken) {
                console.error('[Background] No request token found');
                return;
            }

            const accessToken = await getAccessToken(requestToken);
            if (!accessToken) {
                console.error('[Background] Failed to get access token');
                return;
            }

            // Store access token
            await setAccessToken(accessToken);
            console.log('[Background] Access token stored successfully');

            // Get username
            const username = await getUsername(accessToken);
            if (username) {
                await storeUsername(username);
                console.log('[Background] Username stored successfully');
            }

            // Broadcast auth completion
            chrome.runtime.sendMessage({
                type: 'AUTH_COMPLETE',
                accessToken: accessToken,
                username: username
            });
        } catch (error) {
            console.error('[Background] Error handling OAuth:', error);
            chrome.runtime.sendMessage({
                type: 'AUTH_ERROR',
                error: error.message
            });
        }
        return;
    }

    // Only process URL changes and complete page loads
    if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
        console.log('[Background] Processing tab update:', tab.url);
        await updateTabInCache(tab);
    }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_TAB_INFO') {
        getTabCache().then(cache => {
            sendResponse({ tabInfo: cache[message.tabId] });
        });
        return true; // Keep the message channel open for async response
    }
});

// Check if we need to sync tags
async function shouldSyncTags() {
    const { lastFetch } = await getStoredTags();
    const now = Date.now();
    return !lastFetch || (now - lastFetch) > CACHE_DURATION;
}

// Sync tags in the background
async function syncTags() {
    // If already syncing, skip
    if (isSyncing) {
        console.log('Sync already in progress, skipping');
        return;
    }

    try {
        // Check rate limit before starting sync
        if (!isWithinRateLimit()) {
            console.log('Rate limit reached, skipping sync');
            return;
        }

        // Set sync flag
        isSyncing = true;

        // Check if tag suggestions are enabled
        const enabled = await getTagSuggestionsEnabled();
        if (!enabled) {
            console.log('Tag suggestions are disabled, skipping sync');
            return;
        }

        // Check if we need to sync
        if (!await shouldSyncTags()) {
            console.log('Tags are up to date, skipping sync');
            return;
        }

        console.log('Starting background tag sync...');
        
        // Get access token
        const accessToken = await getStoredAccessToken();
        if (!accessToken) {
            console.log('No access token found, skipping sync');
            return;
        }

        // Record API call before starting sync
        recordApiCall();

        // Fetch and store tags
        const tags = await fetchAllTagsWithToken(accessToken);
        await storeTags(tags);
        console.log('Background tag sync completed');
    } catch (error) {
        console.error('Error in background tag sync:', error);
    } finally {
        // Always reset sync flag
        isSyncing = false;
    }
}

// Update extension icon tooltip
async function updateIconTooltip() {
    try {
        const keyboardShortcut = await getKeyboardShortcut();
        
        const tooltip = keyboardShortcut ? 
            `Save to Pocket (${keyboardShortcut})` : 
            'Save to Pocket';
            
        await chrome.action.setTitle({ title: tooltip });
        console.log('Updated icon tooltip:', tooltip);
    } catch (error) {
        console.error('Error updating icon tooltip:', error);
    }
}

// Update keyboard shortcut
async function updateKeyboardShortcut() {
    try {
        const keyboardShortcut = await getKeyboardShortcut();
        
        if (keyboardShortcut) {
            // First check if the shortcut is already in use
            const commands = await new Promise((resolve) => {
                chrome.commands.getAll(resolve);
            });
            
            const isInUse = commands.some(cmd => 
                cmd.shortcut === keyboardShortcut && cmd.name !== '_execute_action'
            );
            
            if (isInUse) {
                console.error('Shortcut is already in use by another extension');
                // Clear the shortcut from storage since it's not usable
                await removeKeyboardShortcut();
                return;
            }
            
            // Store the shortcut preference
            console.log('Stored keyboard shortcut preference:', keyboardShortcut);
        } else {
            // Clear the shortcut from storage if none is set
            await removeKeyboardShortcut();
            console.log('Cleared keyboard shortcut preference');
        }
        
        // Update the icon tooltip
        await updateIconTooltip();
    } catch (error) {
        console.error('Error updating keyboard shortcut:', error);
        // If there's an error, try to clear the shortcut from storage
        try {
            await removeKeyboardShortcut();
        } catch (clearError) {
            console.error('Error clearing shortcut from storage:', clearError);
        }
    }
}

// Listen for installation or update
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed/updated');
    await initializeServiceWorker();
});

// Listen for Chrome startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('Chrome started up');
    await initializeServiceWorker();
});

// Listen for service worker activation
chrome.runtime.onStartup.addListener(async () => {
    console.log('Service worker started');
    await initializeServiceWorker();
});

// Listen for messages from popup and options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.type === 'INITIALIZE_TAB_CACHE') {
        console.log('Received tab cache initialization request');
        initializeTabCache().then(() => {
            console.log('Tab cache initialization completed');
            sendResponse({ status: 'success' });
        }).catch(error => {
            console.error('Error initializing tab cache:', error);
            sendResponse({ error: error.message });
        });
        return true;
    }

    if (message.type === 'WAKE_UP') {
        console.log('Service worker woke up');
        // Update keyboard shortcut and tooltip when service worker wakes up
        updateKeyboardShortcut();
        
        // Check if we need to sync tags
        chrome.storage.local.get(['last_sync_time', 'tag_suggestions_enabled'], async (result) => {
            const now = Date.now();
            const lastSyncTime = result.last_sync_time || 0;
            const tagSuggestionsEnabled = result.tag_suggestions_enabled || false;
            
            if (tagSuggestionsEnabled && (now - lastSyncTime > CACHE_DURATION)) {
                console.log('Starting tag sync after wake up');
                syncTags();
            }
        });

        // Initialize tab cache on wake up
        initializeTabCache().then(() => {
            console.log('Tab cache initialized after wake up');
        }).catch(error => {
            console.error('Error initializing tab cache after wake up:', error);
        });

        sendResponse({ status: 'woke up' });
        return true;
    }
    
    if (message.type === 'REQUEST_TAG_SYNC') {
        console.log('Received tag sync request');
        syncTags().then(() => {
            sendResponse({ status: 'success' });
        }).catch(error => {
            console.error('Tag sync failed:', error);
            sendResponse({ error: error.message });
        });
        return true;
    }

    if (message.type === 'NEW_TAG_ADDED') {
        console.log('Received new tag:', message.tag);
        addNewTag(message.tag).then(() => {
            sendResponse({ status: 'success' });
        }).catch(error => {
            console.error('Failed to add new tag:', error);
            sendResponse({ error: error.message });
        });
        return true;
    }
});

// Set up periodic sync
setInterval(async () => {
    console.log('Running periodic sync check');
    const enabled = await getTagSuggestionsEnabled();
    if (enabled) {
        console.log('Tag suggestions are enabled, checking sync status');
        const { lastFetch } = await getStoredTags();
        const now = Date.now();
        
        if (!lastFetch || (now - lastFetch) > CACHE_DURATION) {
            console.log('Starting periodic tag sync');
            syncTags();
        } else {
            console.log('Tags are up to date, skipping sync');
        }
    } else {
        console.log('Tag suggestions are disabled, skipping sync');
    }
}, CACHE_DURATION);

// Add new tag to cached tags
async function addNewTag(tag) {
    try {
        const { tags: existingTags } = await getStoredTags();
        if (!existingTags.includes(tag)) {
            const updatedTags = [...existingTags, tag];
            await storeTags(updatedTags);
            console.log(`Added new tag to cache: ${tag}`);
        }
    } catch (error) {
        console.error('Error adding new tag to cache:', error);
    }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === '_execute_action') {
        console.log('Keyboard shortcut triggered to open popup');
        // Chrome will automatically open the popup for _execute_action
    }
});