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
    REQUEST_TOKEN: 'request_token',
    TAB_CACHE: 'tab_cache',
    POPUP_CLOSE_INTERVAL: 'popup_close_interval',
    DEV_MODE_ENABLED: 'dev_mode_enabled',
    TAB_CACHE_ENABLED: 'tab_cache_enabled'
};

// Authorization functions
async function getRequestToken() {
    try {
        console.log('[Background] Requesting token with redirect URI:', POCKET_REDIRECT_URI);
        const response = await fetch('https://getpocket.com/v3/oauth/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Accept': 'application/json'
            },
            body: JSON.stringify({
                consumer_key: POCKET_CONSUMER_KEY,
                redirect_uri: POCKET_REDIRECT_URI
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Background] Request token response not OK:', response.status, errorText);
            throw new Error(`Failed to get request token: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('[Background] Received request token:', data.code);
        return data.code;
    } catch (error) {
        console.error('[Background] Error getting request token:', error);
        throw error;
    }
}

async function getAccessToken(requestToken) {
    try {
        console.log('[Background] Requesting access token with code:', requestToken);
        const response = await fetch('https://getpocket.com/v3/oauth/authorize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Accept': 'application/json'
            },
            body: JSON.stringify({
                consumer_key: POCKET_CONSUMER_KEY,
                code: requestToken
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Background] Access token response not OK:', response.status, errorText);
            throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('[Background] Received access token');
        return data.access_token;
    } catch (error) {
        console.error('[Background] Error getting access token:', error);
        throw error;
    }
}

// Message handler for authorization requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_AUTH') {
        handleAuthRequest(sender, sendResponse);
        return true; // Will respond asynchronously
    }
});

async function handleAuthRequest(sender, sendResponse) {
    try {
        // Get request token
        const requestToken = await getRequestToken();
        
        // Store request token temporarily
        await chrome.storage.local.set({ [STORAGE_KEYS.REQUEST_TOKEN]: requestToken });
        
        // Open Pocket authorization page
        const authUrl = `https://getpocket.com/auth/authorize?request_token=${requestToken}&redirect_uri=${encodeURIComponent(POCKET_REDIRECT_URI)}`;
        console.log('[Background] Launching auth flow with URL:', authUrl);
        
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });
        
        if (!redirectUrl) {
            throw new Error('Authorization flow was cancelled or failed');
        }
        
        console.log('[Background] Received redirect URL:', redirectUrl);
        
        // Get access token
        const accessToken = await getAccessToken(requestToken);
        
        // Store the access token
        await chrome.storage.local.set({ [STORAGE_KEYS.ACCESS_TOKEN]: accessToken });
        
        // Clear request token
        await chrome.storage.local.remove([STORAGE_KEYS.REQUEST_TOKEN]);
        
        // Send success response
        sendResponse({ success: true, accessToken });
        
        // Broadcast auth completion
        chrome.runtime.sendMessage({
            type: 'AUTH_COMPLETE',
            accessToken: accessToken
        });
    } catch (error) {
        console.error('[Background] Error during auth:', error);
        sendResponse({ success: false, error: error.message });
        
        // Broadcast auth error
        chrome.runtime.sendMessage({
            type: 'AUTH_ERROR',
            error: error.message
        });
    }
}

// Cache duration in milliseconds (5 hours)
const CACHE_DURATION = 5 * 60 * 60 * 1000;  // 5 hours in milliseconds

// Flag to track if sync is in progress
let isSyncing = false;

// Rate limiting configuration
const MAX_CALLS_PER_HOUR = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MIN_SYNC_INTERVAL = RATE_LIMIT_WINDOW / MAX_CALLS_PER_HOUR; // Minimum time between syncs

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

// Check if an item exists in Pocket
async function checkPocketItemStatus(accessToken, url) {
    try {
        console.log('[Background] Checking Pocket status for:', url);
        const response = await fetch('https://getpocket.com/v3/get', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Accept': 'application/json'
            },
            body: JSON.stringify({
                consumer_key: POCKET_CONSUMER_KEY,
                access_token: accessToken,
                url: url,
                count: 10,  // Increased from 1 to 10 to check more items
                detailType: 'complete'  // Get full item details including tags
            })
        });

        if (!response.ok) {
            console.error('[Background] Failed to check Pocket status:', response.status);
            return null;
        }

        const data = await response.json();
        const items = Object.values(data.list || {});
        
        // Check all items for a URL match
        for (const item of items) {
            if (item.resolved_url === url || item.given_url === url) {
                console.log('[Background] Found matching item in Pocket:', {
                    url,
                    resolved_url: item.resolved_url,
                    given_url: item.given_url
                });
                return {
                    exists: true,
                    timestamp: Date.now(),
                    tags: item.tags ? Object.keys(item.tags) : [],
                    title: item.resolved_title || item.given_title,
                    item_id: item.item_id
                };
            }
        }
        
        console.log('[Background] No matching item found in Pocket for URL:', url);
        return null;
    } catch (error) {
        console.error('[Background] Error checking Pocket status:', error);
        return null;
    }
}

// Get tab cache enabled status
async function isTabCacheEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAB_CACHE_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.TAB_CACHE_ENABLED] ?? false);
        });
    });
}

// Initialize tab cache
async function initializeTabCache() {
    console.log('[Background] Starting tab cache initialization...');
    try {
        // Check if tab cache is enabled
        const enabled = await isTabCacheEnabled();
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

// Get tab cache
async function getTabCache() {
    return new Promise(async (resolve) => {
        // First check if tab cache is enabled
        const enabled = await isTabCacheEnabled();
        if (!enabled) {
            console.log('[Background] Tab cache is disabled, returning empty cache');
            resolve({});
            return;
        }

        // If enabled, get the cache
        chrome.storage.local.get([STORAGE_KEYS.TAB_CACHE], (result) => {
            resolve(result[STORAGE_KEYS.TAB_CACHE] || {});
        });
    });
}

// Store tab cache
async function storeTabCache(cache) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE]: cache }, resolve);
    });
}

// Update tab in cache
async function updateTabInCache(tab) {
    console.log('[Background] Updating tab in cache:', tab.url);
    try {
        // Check if tab cache is enabled
        const enabled = await isTabCacheEnabled();
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
        const enabled = await isTabCacheEnabled();
        if (!enabled) {
            console.log('[Background] Tab cache is disabled, skipping removal');
            return;
        }

        // Get the tab cache
        const cache = await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.TAB_CACHE], (result) => {
                resolve(result[STORAGE_KEYS.TAB_CACHE] || {});
            });
        });

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
        await new Promise((resolve) => {
            chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE]: updatedCache }, resolve);
        });
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
            await storeAccessToken(accessToken);
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

// Store access token
async function storeAccessToken(token) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEYS.ACCESS_TOKEN]: token }, resolve);
    });
}

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_TAB_INFO') {
        getTabCache().then(cache => {
            sendResponse({ tabInfo: cache[message.tabId] });
        });
        return true; // Keep the message channel open for async response
    }
});

// Get stored access token
async function getStoredAccessToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN], (result) => {
            resolve(result[STORAGE_KEYS.ACCESS_TOKEN]);
        });
    });
}

// Fetch tags using an access token
async function fetchTagsWithToken(accessToken) {
    try {
        const tags = new Set();
        let offset = 0;
        const count = 100; // Maximum allowed by Pocket API
        let hasMore = true;
        let consecutiveErrors = 0;
        const MAX_CONSECUTIVE_ERRORS = 3;
        const BATCH_PAUSE = 2000; // 2 second pause between batches
        const ERROR_PAUSE = 30000; // 30 second pause after rate limit error

        // Try to resume from last offset
        const lastOffset = await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.LAST_SYNC_OFFSET], (result) => {
                resolve(result[STORAGE_KEYS.LAST_SYNC_OFFSET] || 0);
            });
        });

        // If we have a last offset, try to get existing tags
        if (lastOffset > 0) {
            const { tags: existingTags } = await getStoredTags();
            if (existingTags && existingTags.length > 0) {
                existingTags.forEach(tag => tags.add(tag));
                console.log(`Resuming sync with ${tags.size} existing tags`);
            }
        }

        offset = lastOffset;

        while (hasMore) {
            try {
                console.log(`Fetching Pocket items (offset: ${offset})...`);
                const response = await fetch('https://getpocket.com/v3/get', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8',
                        'X-Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        consumer_key: POCKET_CONSUMER_KEY,
                        access_token: accessToken,
                        count: count,
                        offset: offset,
                        detailType: 'complete'  // Get full item details including tags
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Failed to fetch tags from Pocket, status:', response.status);
                    console.error('Error response:', errorText);

                    // Check if it's a rate limit error
                    if (response.status === 429 || errorText.includes('rate limit')) {
                        console.log('Rate limit hit, pausing for 30 seconds...');
                        await new Promise(resolve => setTimeout(resolve, ERROR_PAUSE));
                        continue; // Retry the same batch
                    }

                    throw new Error(`Failed to fetch tags from Pocket: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                
                // Extract unique tags from current batch of items
                if (data && data.list) {
                    Object.values(data.list).forEach(item => {
                        if (item.tags) {
                            Object.keys(item.tags).forEach(tag => {
                                tags.add(tag);
                            });
                        }
                    });

                    // Save intermediate results
                    await storeTags(Array.from(tags));
                    await new Promise((resolve) => {
                        chrome.storage.local.set({
                            [STORAGE_KEYS.LAST_SYNC_OFFSET]: offset + count
                        }, resolve);
                    });

                    // Reset consecutive errors on success
                    consecutiveErrors = 0;
                }

                // Check if we have more items to fetch
                hasMore = data && data.list && Object.keys(data.list).length === count;
                offset += count;

                // Add a pause between batches to avoid rate limits
                if (hasMore) {
                    console.log(`Pausing for ${BATCH_PAUSE/1000} seconds before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE));
                }

            } catch (error) {
                console.error('Error in batch:', error);
                consecutiveErrors++;

                if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                    console.log('Too many consecutive errors, stopping sync');
                    // Save progress before stopping
                    await storeTags(Array.from(tags));
                    await new Promise((resolve) => {
                        chrome.storage.local.set({
                            [STORAGE_KEYS.LAST_SYNC_OFFSET]: offset
                        }, resolve);
                    });
                    throw new Error('Sync stopped due to too many consecutive errors');
                }

                // Wait before retrying
                console.log(`Waiting ${ERROR_PAUSE/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, ERROR_PAUSE));
            }
        }

        // Clear the last offset since we're done
        await new Promise((resolve) => {
            chrome.storage.local.remove([STORAGE_KEYS.LAST_SYNC_OFFSET], resolve);
        });

        console.log(`Finished fetching all Pocket items. Found ${tags.size} unique tags.`);
        return Array.from(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        throw error;
    }
}

// Get stored tags from Chrome storage
async function getStoredTags() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAGS, STORAGE_KEYS.TAGS_LAST_FETCH], (result) => {
            resolve({
                tags: result[STORAGE_KEYS.TAGS] || [],
                lastFetch: result[STORAGE_KEYS.TAGS_LAST_FETCH] || 0
            });
        });
    });
}

// Store tags in Chrome storage
async function storeTags(tags) {
    return new Promise((resolve) => {
        chrome.storage.local.set({
            [STORAGE_KEYS.TAGS]: tags,
            [STORAGE_KEYS.TAGS_LAST_FETCH]: Date.now()
        }, resolve);
    });
}

// Check if we need to sync tags
async function shouldSyncTags() {
    const { lastFetch } = await getStoredTags();
    const now = Date.now();
    return !lastFetch || (now - lastFetch) > CACHE_DURATION;
}

// Get tag suggestions enabled status
async function getTagSuggestionsEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED] ?? false);
        });
    });
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
        const tags = await fetchTagsWithToken(accessToken);
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
        const result = await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.KEYBOARD_SHORTCUT], resolve);
        });
        
        const customShortcut = result[STORAGE_KEYS.KEYBOARD_SHORTCUT];
        const tooltip = customShortcut ? 
            `Save to Pocket (${customShortcut})` : 
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
        const result = await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.KEYBOARD_SHORTCUT], resolve);
        });
        
        const customShortcut = result[STORAGE_KEYS.KEYBOARD_SHORTCUT];
        
        if (customShortcut) {
            // First check if the shortcut is already in use
            const commands = await new Promise((resolve) => {
                chrome.commands.getAll(resolve);
            });
            
            const isInUse = commands.some(cmd => 
                cmd.shortcut === customShortcut && cmd.name !== '_execute_action'
            );
            
            if (isInUse) {
                console.error('Shortcut is already in use by another extension');
                // Clear the shortcut from storage since it's not usable
                await new Promise((resolve) => {
                    chrome.storage.local.remove([STORAGE_KEYS.KEYBOARD_SHORTCUT], resolve);
                });
                return;
            }
            
            // Store the shortcut preference
            console.log('Stored keyboard shortcut preference:', customShortcut);
        } else {
            // Clear the shortcut from storage if none is set
            await new Promise((resolve) => {
                chrome.storage.local.remove([STORAGE_KEYS.KEYBOARD_SHORTCUT], resolve);
            });
            console.log('Cleared keyboard shortcut preference');
        }
        
        // Update the icon tooltip
        await updateIconTooltip();
    } catch (error) {
        console.error('Error updating keyboard shortcut:', error);
        // If there's an error, try to clear the shortcut from storage
        try {
            await new Promise((resolve) => {
                chrome.storage.local.remove([STORAGE_KEYS.KEYBOARD_SHORTCUT], resolve);
            });
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

// Get stored request token
async function getStoredRequestToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.REQUEST_TOKEN], (result) => {
            resolve(result[STORAGE_KEYS.REQUEST_TOKEN]);
        });
    });
} 