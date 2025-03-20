// Common tag suggestions based on the page content
const commonTags = [
    'article', 'blog', 'news', 'tutorial', 'reference',
    'video', 'tool', 'inspiration', 'design', 'development'
];

// Pocket API configuration
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
    POPUP_CLOSE_INTERVAL: 'popup_close_interval',
    DEV_MODE_ENABLED: 'dev_mode_enabled',
    TAB_CACHE: 'tab_cache'
};

// Cache duration in milliseconds (5 hours)
const CACHE_DURATION = 5 * 60 * 60 * 1000;

// Auto-close timer
let closeTimer = null;
let hasUnsavedChanges = false;

// Get popup close interval from storage
async function getPopupCloseInterval() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.POPUP_CLOSE_INTERVAL], (result) => {
            resolve(result[STORAGE_KEYS.POPUP_CLOSE_INTERVAL] ?? 3); // Default to 3 seconds
        });
    });
}

// Setup auto-close timer
async function setupAutoClose() {
    const interval = await getPopupCloseInterval();
    if (interval <= 0) return; // Don't auto-close if interval is 0 or negative
    
    // Clear existing timer if any
    if (closeTimer) {
        clearTimeout(closeTimer);
    }
    
    // Set new timer
    closeTimer = setTimeout(() => {
        if (!hasUnsavedChanges) {
            window.close();
        }
    }, interval * 1000); // Convert seconds to milliseconds
}

// Reset auto-close timer
function resetAutoClose() {
    if (closeTimer) {
        clearTimeout(closeTimer);
        setupAutoClose();
    }
}

// Mark changes as unsaved
function markUnsavedChanges() {
    hasUnsavedChanges = true;
}

// Mark changes as saved
function markSavedChanges() {
    hasUnsavedChanges = false;
}

// Get developer mode status
async function getDevModeEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.DEV_MODE_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.DEV_MODE_ENABLED] ?? false);
        });
    });
}

// Setup developer mode console
async function setupDevConsole() {
    const devModeToggle = document.getElementById('devModeToggle');
    const devConsole = document.getElementById('devConsole');
    const consoleMessages = document.getElementById('consoleMessages');
    const clearConsole = document.getElementById('clearConsole');
    
    // Check if developer mode is enabled in options
    const devModeEnabled = await getDevModeEnabled();
    
    // Show/hide developer mode toggle based on options
    devModeToggle.parentElement.style.display = devModeEnabled ? 'flex' : 'none';
    devModeToggle.checked = false;
    devConsole.classList.remove('visible');
    
    // Handle toggle change
    devModeToggle.addEventListener('change', function() {
        if (this.checked) {
            devConsole.classList.add('visible');
        } else {
            devConsole.classList.remove('visible');
        }
    });
    
    // Handle clear button
    clearConsole.addEventListener('click', function() {
        consoleMessages.innerHTML = '';
    });
    
    // Intercept console methods
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Helper to add message to dev console
    function addMessage(type, args) {
        if (!devModeToggle.checked || !devModeEnabled) return;
        
        const message = Array.from(args).map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        const timestamp = new Date().toLocaleTimeString();
        const messageEl = document.createElement('div');
        messageEl.className = `console-message ${type}`;
        messageEl.innerHTML = `<span class="timestamp">${timestamp}</span> ${message}`;
        
        consoleMessages.appendChild(messageEl);
        consoleMessages.scrollTop = consoleMessages.scrollHeight;
    }
    
    // Override console methods
    console.log = function() {
        addMessage('log', arguments);
        originalLog.apply(console, arguments);
    };
    
    console.error = function() {
        addMessage('error', arguments);
        originalError.apply(console, arguments);
    };
    
    console.warn = function() {
        addMessage('warn', arguments);
        originalWarn.apply(console, arguments);
    };
}

// Get stored tag suggestions preference
async function getTagSuggestionsEnabled() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED], (result) => {
            resolve(result[STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED] ?? false);
        });
    });
}

// Get stored tags from Chrome storage
async function getStoredTags() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAGS], (result) => {
            resolve(result[STORAGE_KEYS.TAGS] || []);
        });
    });
}

// Get tag suggestions from Pocket based on input
async function getPocketTagSuggestions(input) {
    try {
        // Check if tag suggestions are enabled
        const enabled = await getTagSuggestionsEnabled();
        if (!enabled) {
            console.log('[Popup] Tag suggestions are disabled');
            return [];
        }
        
        console.log('[Popup] Fetching tag suggestions for:', input);
        
        // Get cached tags
        const tags = await getStoredTags();
        
        // If no tags in cache, return empty array
        if (!tags || tags.length === 0) {
            console.log('[Popup] No cached tags found');
            return [];
        }
        
        // Filter tags based on input
        console.log('[Popup] Filtering tags with input:', input);
        const matchingTags = tags.filter(tag => 
            tag.toLowerCase().includes(input.toLowerCase())
        );
        console.log('[Popup] Found matching tags:', matchingTags);
        
        return matchingTags;
    } catch (error) {
        console.error('[Popup] Error in getPocketTagSuggestions:', error);
        console.error('[Popup] Error stack:', error.stack);
        return [];
    }
}

// Get relevant tag suggestions based on page content
async function getTagSuggestions(url, title) {
    try {
        // Check if tag suggestions are enabled
        const enabled = await getTagSuggestionsEnabled();
        if (!enabled) {
            console.log('[Popup] Tag suggestions are disabled');
            return [];
        }
        
        // Get user's existing tags from storage
        const tags = await getStoredTags();
        
        // Add domain name as a potential tag
        let suggestions = [...tags];
        try {
            const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
            if (domain && !suggestions.includes(domain)) {
                suggestions.unshift(domain);
            }
        } catch (e) {
            console.error('[Popup] Error parsing URL:', e);
        }

        // Limit to 5 suggestions
        return suggestions.slice(0, 5);
    } catch (error) {
        console.error('[Popup] Error getting tag suggestions:', error);
        // Fallback to domain name if tags fail
        try {
            const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
            return domain ? [domain] : [];
        } catch (e) {
            return [];
        }
    }
}

// Get stored access token
async function getStoredAccessToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN], (result) => {
            resolve(result[STORAGE_KEYS.ACCESS_TOKEN]);
        });
    });
}

// Get existing item from Pocket
async function getExistingItem(url) {
    try {
        const accessToken = await getStoredAccessToken();
        if (!accessToken) {
            throw new Error('No access token found');
        }

        console.log('[Popup] Fetching existing item for URL:', url);
        
        // Clean the URL - remove @ symbol and https:// prefix
        const searchUrl = url.replace(/^@/, '').replace(/^https?:\/\//, '');
        console.log('[Popup] Searching with URL:', searchUrl);
        
        const response = await fetch('https://getpocket.com/v3/get', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Accept': 'application/json'
            },
            body: JSON.stringify({
                consumer_key: POCKET_CONSUMER_KEY,
                access_token: accessToken,
                state: 'all',  // Get all items including archived
                detailType: 'complete',  // Get full item details
                search: searchUrl,  // Search for the specific URL
                count: 100  // Get more items to increase chance of finding the URL
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to check existing item: ${response.status}`);
        }

        const data = await response.json();
        console.log('[Popup] Pocket API response status:', data.status);
        
        // The API returns items in a list object, where each item is keyed by its item_id
        if (data.list) {
            // Normalize URLs for comparison
            const normalizedSearchUrl = normalizeUrl(searchUrl);
            console.log('[Popup] Normalized search URL:', normalizedSearchUrl);

            // Find the item that matches our URL
            const matchingItem = Object.values(data.list).find(item => {
                const itemUrl = item.resolved_url || item.given_url;
                const normalizedItemUrl = normalizeUrl(itemUrl);
                
                console.log('[Popup] Comparing URLs:', {
                    itemUrl,
                    normalizedItemUrl,
                    searchUrl: searchUrl,
                    normalizedSearchUrl,
                    matches: normalizedItemUrl === normalizedSearchUrl
                });
                
                return normalizedItemUrl === normalizedSearchUrl;
            });

            if (matchingItem) {
                console.log('[Popup] Found matching item:', {
                    item_id: matchingItem.item_id,
                    resolved_url: matchingItem.resolved_url,
                    given_url: matchingItem.given_url,
                    resolved_title: matchingItem.resolved_title,
                    tags: matchingItem.tags ? Object.keys(matchingItem.tags) : [],
                    has_tags: !!matchingItem.tags,
                    tag_count: matchingItem.tags ? Object.keys(matchingItem.tags).length : 0
                });
                return matchingItem;
            } else {
                console.log('[Popup] No matching item found');
            }
        }
        
        // Item doesn't exist, return null
        return null;
    } catch (error) {
        console.error('[Popup] Error checking existing item:', error);
        throw error;
    }
}

// Helper function to normalize URLs for comparison
function normalizeUrl(url) {
    if (!url) return '';
    try {
        // Remove protocol
        let normalized = url.replace(/^https?:\/\//, '');
        // Remove www.
        normalized = normalized.replace(/^www\./, '');
        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');
        // Convert to lowercase
        normalized = normalized.toLowerCase();
        return normalized;
    } catch (e) {
        console.error('[Popup] Error normalizing URL:', e);
        return url;
    }
}

// Save new item to Pocket
async function saveNewItem(url, title) {
    try {
        const accessToken = await getStoredAccessToken();
        if (!accessToken) {
            throw new Error('No access token found');
        }

        console.log('[Popup] Saving new item to Pocket:', { url, title });
        
        const saveResponse = await fetch('https://getpocket.com/v3/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Accept': 'application/json'
            },
            body: JSON.stringify({
                url: url,
                title: title,
                consumer_key: POCKET_CONSUMER_KEY,
                access_token: accessToken
            })
        });

        if (!saveResponse.ok) {
            const errorText = await saveResponse.text();
            throw new Error(`Failed to save item: ${saveResponse.status} ${errorText}`);
        }

        const saveData = await saveResponse.json();
        console.log('[Popup] Save response:', saveData);
        
        // Wait a moment for Pocket to process the save
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update button text to "Update Tags"
        const saveButton = document.querySelector('.save-button');
        saveButton.textContent = 'Update Tags';
        
        return saveData;
    } catch (error) {
        console.error('[Popup] Error saving new item:', error);
        throw error;
    }
}

// Save URL to Pocket
async function saveToPocket(url, title, tags) {
    try {
        console.log('[Popup] Starting saveToPocket with:', { url, title, tags });
        
        // Get access token
        const accessToken = await getStoredAccessToken();
        if (!accessToken) {
            console.error('[Popup] No access token found');
            throw new Error('No access token found. Please connect your Pocket account in the extension options.');
        }
        console.log('[Popup] Got access token:', accessToken.substring(0, 10) + '...');

        // Check cache first
        console.log('[Popup] Checking cache for existing item...');
        const cache = await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.TAB_CACHE], (result) => {
                resolve(result[STORAGE_KEYS.TAB_CACHE] || {});
            });
        });

        const cachedItem = cache[url];
        const now = Date.now();
        const isCacheValid = cachedItem && (now - cachedItem.timestamp < CACHE_DURATION);

        console.log('[Popup] Cache check:', {
            hasEntry: !!cachedItem,
            isExpired: cachedItem ? (now - cachedItem.timestamp > CACHE_DURATION) : true,
            cacheAge: cachedItem ? Math.round((now - cachedItem.timestamp) / 1000) + ' seconds' : 'N/A'
        });

        let existingItem = null;
        // Always check Pocket API if cache indicates item doesn't exist
        if (!cachedItem || !cachedItem.pocketStatus || !cachedItem.pocketStatus.exists || !isCacheValid) {
            console.log('[Popup] Cache indicates item does not exist or is invalid, checking Pocket API...');
            existingItem = await getExistingItem(url);
        } else {
            console.log('[Popup] Using cached item info');
            existingItem = {
                item_id: cachedItem.pocketStatus.item_id,
                tags: cachedItem.pocketStatus.tags || {},
                resolved_title: cachedItem.pocketStatus.title
            };
        }

        if (existingItem) {
            // Item exists, update tags
            console.log('[Popup] Item exists, updating tags...');
            console.log('[Popup] Item ID:', existingItem.item_id);
            console.log('[Popup] Current tags:', existingItem.tags ? Object.keys(existingItem.tags) : []);
            console.log('[Popup] New tags to set:', tags);
            
            const updateBody = {
                consumer_key: POCKET_CONSUMER_KEY,
                access_token: accessToken,
                actions: [{
                    action: 'tags_replace',
                    item_id: existingItem.item_id,
                    tags: tags.join(',')
                }]
            };

            console.log('[Popup] Sending update request with body:', updateBody);
            const updateResponse = await fetch('https://getpocket.com/v3/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Accept': 'application/json'
                },
                body: JSON.stringify(updateBody)
            });

            if (!updateResponse.ok) {
                const errorText = await updateResponse.text();
                console.error('[Popup] Failed to update Pocket item:', {
                    status: updateResponse.status,
                    statusText: updateResponse.statusText,
                    error: errorText
                });
                throw new Error(`Failed to update Pocket item: ${updateResponse.status} ${errorText}`);
            }

            const updateData = await updateResponse.json();
            console.log('[Popup] Update response:', updateData);

            // Always update the cache after a successful tag update
            cache[url] = {
                url: url,
                title: title,
                pocketStatus: {
                    exists: true,
                    timestamp: Date.now(),
                    tags: tags,
                    title: title,
                    item_id: existingItem.item_id
                },
                timestamp: Date.now()
            };
            
            await new Promise((resolve) => {
                chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE]: cache }, resolve);
            });
            console.log('[Popup] Updated local cache with new tags and item_id:', {
                url,
                item_id: existingItem.item_id,
                tags
            });

            return true;
        } else {
            // Item doesn't exist, create new
            console.log('[Popup] Item does not exist, creating new...');
            const requestBody = {
                url: url,
                title: title,
                consumer_key: POCKET_CONSUMER_KEY,
                access_token: accessToken
            };

            // Add tags if any exist
            if (tags && tags.length > 0) {
                requestBody.tags = tags.join(',');
                console.log('[Popup] Adding tags:', tags);
            }

            const response = await fetch('https://getpocket.com/v3/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'X-Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Popup] Failed to save to Pocket:', response.status, errorText);
                throw new Error(`Failed to save to Pocket: ${response.status} ${errorText}`);
            }

            const responseData = await response.json();
            console.log('[Popup] Save response:', responseData);

            // Update local cache with new item
            cache[url] = {
                url: url,
                title: title,
                pocketStatus: {
                    exists: true,
                    timestamp: Date.now(),
                    tags: tags,
                    title: title,
                    item_id: responseData.item.item_id
                },
                timestamp: Date.now()
            };
            await new Promise((resolve) => {
                chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE]: cache }, resolve);
            });
            console.log('[Popup] Updated local cache with new item:', {
                url,
                item_id: responseData.item.item_id,
                tags
            });

            return true;
        }
    } catch (error) {
        console.error('[Popup] Error saving to Pocket:', error);
        throw error;
    }
}

// Check authorization state and show appropriate container
async function checkAuthorization() {
    const unauthorizedContainer = document.getElementById('unauthorizedContainer');
    const mainContainer = document.getElementById('mainContainer');
    const connectButton = document.getElementById('connectButton');
    
    try {
        const { access_token } = await chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN]);
        
        if (!access_token) {
            unauthorizedContainer.classList.add('active');
            mainContainer.classList.remove('active');
            
            // Handle connect button click
            connectButton.addEventListener('click', async () => {
                try {
                    // Show loading state
                    connectButton.disabled = true;
                    connectButton.textContent = 'Connecting...';
                    
                    console.log('Requesting token from Pocket...');
                    const response = await fetch('https://getpocket.com/v3/oauth/request', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            consumer_key: POCKET_CONSUMER_KEY,
                            redirect_uri: POCKET_REDIRECT_URI
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('Request token response:', data);
                    
                    if (!data.code) {
                        throw new Error('No request token received');
                    }
                    
                    const requestToken = data.code;
                    console.log('Received request token:', requestToken);
                    
                    // Store request token temporarily using the correct storage key
                    await new Promise((resolve) => {
                        chrome.storage.local.set({ [STORAGE_KEYS.REQUEST_TOKEN]: requestToken }, () => {
                            console.log('Stored request token in storage');
                            resolve();
                        });
                    });
                    
                    // Verify the token was stored
                    const storedToken = await new Promise((resolve) => {
                        chrome.storage.local.get([STORAGE_KEYS.REQUEST_TOKEN], (result) => {
                            console.log('Verifying stored token:', result[STORAGE_KEYS.REQUEST_TOKEN]);
                            resolve(result[STORAGE_KEYS.REQUEST_TOKEN]);
                        });
                    });
                    
                    if (!storedToken) {
                        throw new Error('Failed to store request token');
                    }
                    
                    // Open auth page in a new tab
                    const authUrl = `https://getpocket.com/auth/authorize?request_token=${requestToken}&redirect_uri=${encodeURIComponent(POCKET_REDIRECT_URI)}`;
                    console.log('Opening auth URL:', authUrl);
                    const authTab = await chrome.tabs.create({ url: authUrl });
                    
                    // Listen for the auth completion message from the background script
                    chrome.runtime.onMessage.addListener(function authListener(message, sender, sendResponse) {
                        if (message.type === 'AUTH_COMPLETE') {
                            // Remove the listener
                            chrome.runtime.onMessage.removeListener(authListener);
                            
                            // Close the auth tab
                            chrome.tabs.remove(authTab.id);
                            
                            // Update UI
                            unauthorizedContainer.classList.remove('active');
                            mainContainer.classList.add('active');
                            initializeMainUI();
                            
                            // Show success message
                            showStatus('Successfully connected to Pocket!', 'success');
                            
                            // Close the popup after a short delay
                            setTimeout(() => {
                                window.close();
                            }, 1500);
                        } else if (message.type === 'AUTH_ERROR') {
                            // Handle error
                            console.error('Auth error:', message.error);
                            connectButton.disabled = false;
                            connectButton.textContent = 'Connect to Pocket';
                            showStatus(`Failed to connect to Pocket: ${message.error}`, 'error');
                        }
                    });
                } catch (error) {
                    console.error('Error during authorization:', error);
                    connectButton.disabled = false;
                    connectButton.textContent = 'Connect to Pocket';
                    showStatus(`Failed to connect to Pocket: ${error.message}`, 'error');
                }
            });
        } else {
            // Already authorized, show main container
            unauthorizedContainer.classList.remove('active');
            mainContainer.classList.add('active');
            initializeMainUI();
        }
    } catch (error) {
        console.error('Error checking authorization:', error);
        showStatus('Error checking authorization status', 'error');
    }
}

// Initialize main UI components
function initializeMainUI() {
    console.log('[Popup] Initializing main UI...');
    
    const urlElement = document.querySelector('.url');
    const tagsInput = document.querySelector('.tags-input');
    const tagSuggestionsDropdown = document.querySelector('.tag-suggestions-dropdown');
    const selectedTagsContainer = document.querySelector('.selected-tags');
    const saveButton = document.querySelector('.save-button');
    const statusElement = document.getElementById('status');
    
    // Get current tab info (which includes Pocket status)
    getCurrentTabInfo().then(async (tabInfo) => {
        if (!tabInfo) {
            console.error('[Popup] Failed to get tab info');
            showStatus('Error getting tab information', 'error');
            saveButton.classList.add('error');
            return;
        }

        console.log('[Popup] Current tab info:', tabInfo);
        urlElement.textContent = tabInfo.url;
        
        try {
            // If item exists in Pocket, update UI accordingly
            if (tabInfo.pocketStatus && tabInfo.pocketStatus.exists) {
                console.log('[Popup] Item exists in Pocket, updating UI');
                
                // Update URL display with resolved title if available
                if (tabInfo.pocketStatus.title) {
                    urlElement.textContent = tabInfo.pocketStatus.title;
                }
                
                // Clear existing tags
                selectedTagsContainer.innerHTML = '';
                
                // Add existing tags
                if (tabInfo.pocketStatus.tags && tabInfo.pocketStatus.tags.length > 0) {
                    console.log('[Popup] Processing existing tags:', tabInfo.pocketStatus.tags);
                    tabInfo.pocketStatus.tags.forEach(tag => {
                        const tagElement = document.createElement('div');
                        tagElement.className = 'selected-tag';
                        tagElement.innerHTML = `
                            ${tag}
                            <span class="remove-tag">&times;</span>
                        `;
                        selectedTagsContainer.appendChild(tagElement);
                        
                        // Handle tag removal
                        tagElement.querySelector('.remove-tag').addEventListener('click', () => {
                            console.log('[Popup] Removing tag:', tag);
                            tagElement.remove();
                        });
                    });
                }
                
                // Update save button text and show status
                saveButton.textContent = 'Update Tags';
                showStatus('Item already saved in Pocket', 'info');
            } else {
                console.log('[Popup] Item does not exist in Pocket, saving automatically...');
                // Show saving status
                showStatus('Saving to Pocket...', 'info');
                saveButton.disabled = true;
                saveButton.innerHTML = '<span class="spinner"></span> Saving...';
                
                // Save the item automatically if it doesn't exist
                try {
                    await saveToPocket(tabInfo.url, tabInfo.title, []);
                    console.log('[Popup] Item saved successfully');
                    saveButton.disabled = false;
                    saveButton.textContent = 'Update Tags';
                    saveButton.classList.remove('error');
                    showStatus('Successfully saved to Pocket!', 'success');
                } catch (error) {
                    console.error('[Popup] Failed to save item:', error);
                    saveButton.disabled = false;
                    saveButton.textContent = 'Save to Pocket';
                    saveButton.classList.add('error');
                    showStatus('Failed to save to Pocket', 'error');
                }
            }
            
            // Setup tag input handling
            let selectedTags = new Set();
            
            // If item exists, add its tags to selectedTags
            if (tabInfo.pocketStatus && tabInfo.pocketStatus.tags) {
                tabInfo.pocketStatus.tags.forEach(tag => {
                    selectedTags.add(tag);
                });
            }
            
            // Handle tag input
            let selectedIndex = -1;
            tagsInput.addEventListener('input', async (e) => {
                const input = e.target.value.trim();
                console.log('[Popup] Tag input received:', input);
                
                if (input) {
                    const suggestions = await getPocketTagSuggestions(input);
                    console.log('[Popup] Tag suggestions:', suggestions);
                    
                    if (suggestions.length > 0) {
                        tagSuggestionsDropdown.innerHTML = suggestions
                            .map((tag, index) => `<div class="tag-suggestion ${index === 0 ? 'selected' : ''}">${tag}</div>`)
                            .join('');
                        tagSuggestionsDropdown.classList.add('visible');
                        selectedIndex = 0;
                    } else {
                        tagSuggestionsDropdown.classList.remove('visible');
                        selectedIndex = -1;
                    }
                } else {
                    tagSuggestionsDropdown.classList.remove('visible');
                    selectedIndex = -1;
                }
            });
            
            // Handle keyboard navigation
            tagsInput.addEventListener('keydown', async (e) => {
                const suggestions = tagSuggestionsDropdown.querySelectorAll('.tag-suggestion');
                const input = tagsInput.value.trim();

                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        if (suggestions.length) {
                            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
                            updateSelectedSuggestion(suggestions, selectedIndex);
                        }
                        break;
                        
                    case 'ArrowUp':
                        e.preventDefault();
                        if (suggestions.length) {
                            selectedIndex = Math.max(selectedIndex - 1, 0);
                            updateSelectedSuggestion(suggestions, selectedIndex);
                        }
                        break;
                        
                    case 'Enter':
                        e.preventDefault();
                        if (input) {
                            if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                                // Add selected suggestion
                                const selectedTag = suggestions[selectedIndex].textContent;
                                addTag(selectedTag);
                                tagsInput.value = '';
                                tagSuggestionsDropdown.classList.remove('visible');
                                selectedIndex = -1;
                            } else {
                                // Add new tag from input
                                addTag(input);
                                tagsInput.value = '';
                                tagSuggestionsDropdown.classList.remove('visible');
                                selectedIndex = -1;
                            }
                        }
                        break;
                        
                    case 'Escape':
                        if (input) {
                            e.preventDefault();
                            tagsInput.value = '';
                            tagSuggestionsDropdown.classList.remove('visible');
                            selectedIndex = -1;
                        }
                        break;
                }
            });
            
            // Update selected suggestion styling
            function updateSelectedSuggestion(suggestions, index) {
                suggestions.forEach((suggestion, i) => {
                    suggestion.classList.toggle('selected', i === index);
                });
            }
            
            // Add tag to the UI
            function addTag(tag) {
                if (!selectedTags.has(tag)) {
                    selectedTags.add(tag);
                    const tagElement = document.createElement('div');
                    tagElement.className = 'selected-tag';
                    tagElement.innerHTML = `
                        ${tag}
                        <span class="remove-tag">&times;</span>
                    `;
                    selectedTagsContainer.appendChild(tagElement);
                    
                    // Handle tag removal
                    tagElement.querySelector('.remove-tag').addEventListener('click', () => {
                        console.log('[Popup] Removing tag:', tag);
                        selectedTags.delete(tag);
                        tagElement.remove();
                    });
                }
            }
            
            // Handle tag suggestion selection
            tagSuggestionsDropdown.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-suggestion')) {
                    const tag = e.target.textContent;
                    addTag(tag);
                    tagsInput.value = '';
                    tagSuggestionsDropdown.classList.remove('visible');
                    selectedIndex = -1;
                }
            });
            
            // Handle save button click
            saveButton.addEventListener('click', async () => {
                try {
                    console.log('[Popup] Save button clicked');
                    saveButton.disabled = true;
                    saveButton.classList.remove('error');
                    saveButton.innerHTML = '<span class="spinner"></span> Saving...';
                    showStatus('Saving changes...', 'info');
                    
                    // Collect all currently displayed tags
                    const tagElements = selectedTagsContainer.querySelectorAll('.selected-tag');
                    const tags = Array.from(tagElements).map(el => {
                        // Get the text content before the remove-tag span
                        const tagText = el.childNodes[0].textContent.trim();
                        return tagText;
                    });
                    console.log('[Popup] Tags to save:', tags);
                    
                    // Add timeout to prevent infinite loading
                    const timeoutPromise = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Save operation timed out')), 10000);
                    });
                    
                    const savePromise = saveToPocket(tabInfo.url, tabInfo.title, tags);
                    
                    await Promise.race([savePromise, timeoutPromise]);
                    console.log('[Popup] Successfully saved to Pocket');
                    
                    showStatus('Successfully saved to Pocket!', 'success');
                    
                    // Close popup after a short delay
                    setTimeout(() => {
                        window.close();
                    }, 1500);
                } catch (error) {
                    console.error('[Popup] Error saving to Pocket:', error);
                    showStatus(`Failed to save to Pocket: ${error.message}`, 'error');
                    saveButton.disabled = false;
                    saveButton.classList.add('error');
                    saveButton.innerHTML = 'Save to Pocket';
                }
            });
        } catch (error) {
            console.error('[Popup] Error initializing main UI:', error);
            showStatus('Error initializing main UI', 'error');
            saveButton.classList.add('error');
        }
    });
    
    // Setup auto-close
    setupAutoClose();
    
    // Add event listeners to reset timer on user interaction
    document.addEventListener('mousemove', resetAutoClose);
    document.addEventListener('keydown', resetAutoClose);
    document.addEventListener('click', resetAutoClose);
    
    // Mark changes as unsaved when user interacts with tag input
    tagsInput.addEventListener('input', () => {
        markUnsavedChanges();
    });
    
    // Mark changes as saved when item is saved
    saveButton.addEventListener('click', () => {
        markSavedChanges();
    });
}

// Show status message
function showStatus(message, type = 'info') {
    console.log('[Popup] Showing status:', message, type);
    const statusElement = document.getElementById('status');
    
    // Remove all existing status classes
    statusElement.classList.remove('success', 'error', 'info', 'warning');
    
    // Add the new status class
    statusElement.classList.add(type);
    
    // Set the message
    statusElement.textContent = message;
    
    // Make sure the status element is visible
    statusElement.style.display = 'block';
}

// Initialize popup
async function initializePopup() {
    console.log('[Popup] Starting popup initialization...');
    try {
        // Get current tab info
        console.log('[Popup] Fetching current tab info...');
        const tabInfo = await getCurrentTabInfo();
        if (!tabInfo) {
            throw new Error('Failed to get tab information');
        }
        console.log('[Popup] Tab info received:', {
            url: tabInfo.url,
            title: tabInfo.title,
            fromCache: tabInfo.fromCache,
            pocketStatus: tabInfo.pocketStatus
        });

        // Update URL input
        const urlInput = document.getElementById('urlInput');
        urlInput.value = tabInfo.url;
        console.log('[Popup] Updated URL input');

        // Update status message based on Pocket status
        const statusMessage = document.getElementById('statusMessage');
        if (tabInfo.pocketStatus && tabInfo.pocketStatus.exists) {
            statusMessage.textContent = 'Already saved to Pocket';
            statusMessage.className = 'status-message saved';
            console.log('[Popup] Item exists in Pocket');
        } else {
            statusMessage.textContent = 'Not saved to Pocket';
            statusMessage.className = 'status-message not-saved';
            console.log('[Popup] Item not in Pocket');
        }

        // Add cache status to status message
        const cacheStatus = tabInfo.fromCache ? ' (from cache)' : ' (fresh)';
        statusMessage.textContent += cacheStatus;
        console.log('[Popup] Cache status:', tabInfo.fromCache ? 'Using cached data' : 'Using fresh data');

        // Get tag suggestions based on URL and title
        console.log('[Popup] Fetching tag suggestions...');
        const tagSuggestions = await getTagSuggestions(tabInfo.url, tabInfo.title);
        console.log('[Popup] Tag suggestions received:', tagSuggestions);
        updateTagSuggestions(tagSuggestions);

        // Setup auto-close timer
        console.log('[Popup] Setting up auto-close timer...');
        await setupAutoClose();
        console.log('[Popup] Popup initialization complete');
    } catch (error) {
        console.error('[Popup] Error initializing popup:', error);
        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = 'Error: ' + error.message;
        statusMessage.className = 'status-message error';
    }
}

// Get current tab information
async function getCurrentTabInfo() {
    console.log('[Popup] Getting current tab info...');
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error('No active tab found');
        }
        console.log('[Popup] Current tab:', { url: tab.url, title: tab.title });

        // Get tab cache
        console.log('[Popup] Fetching tab cache...');
        const cache = await new Promise((resolve) => {
            chrome.storage.local.get([STORAGE_KEYS.TAB_CACHE], (result) => {
                resolve(result[STORAGE_KEYS.TAB_CACHE] || {});
            });
        });
        console.log('[Popup] Cache entries:', Object.keys(cache).length);

        // Get tab info from cache using URL as key
        const tabInfo = cache[tab.url];
        const now = Date.now();
        const isCacheValid = tabInfo && (now - tabInfo.timestamp < CACHE_DURATION);

        console.log('[Popup] Cache check:', {
            hasEntry: !!tabInfo,
            isExpired: tabInfo ? (now - tabInfo.timestamp > CACHE_DURATION) : true,
            cacheAge: tabInfo ? Math.round((now - tabInfo.timestamp) / 1000) + ' seconds' : 'N/A'
        });

        if (tabInfo && isCacheValid) {
            console.log('[Popup] Using cached tab info for:', tab.url);
            return {
                url: tabInfo.url,
                title: tabInfo.title,
                pocketStatus: tabInfo.pocketStatus,
                fromCache: true
            };
        }

        // If not in cache or cache expired, get it directly
        console.log('[Popup] Cache invalid or missing, fetching fresh data for:', tab.url);
        const accessToken = await getStoredAccessToken();
        let pocketStatus = null;
        
        if (accessToken) {
            console.log('[Popup] Checking Pocket status...');
            pocketStatus = await checkPocketItemStatus(accessToken, tab.url);
            console.log('[Popup] Pocket status result:', pocketStatus);
        }
        
        const newTabInfo = {
            url: tab.url,
            title: tab.title,
            pocketStatus: pocketStatus,
            timestamp: now
        };

        // Update cache using URL as key
        console.log('[Popup] Updating cache with fresh data...');
        const updatedCache = { ...cache, [tab.url]: newTabInfo };
        await new Promise((resolve) => {
            chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE]: updatedCache }, resolve);
        });
        console.log('[Popup] Cache updated successfully');

        return {
            ...newTabInfo,
            fromCache: false
        };
    } catch (error) {
        console.error('[Popup] Error getting current tab info:', error);
        return null;
    }
}

// Check if an item exists in Pocket
async function checkPocketItemStatus(accessToken, url) {
    try {
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
                count: 1,
                detailType: 'complete'  // Get full item details including tags
            })
        });

        if (!response.ok) {
            console.error('Failed to check Pocket status:', response.status);
            return null;
        }

        const data = await response.json();
        const items = Object.values(data.list || {});
        if (items.length > 0) {
            const item = items[0];
            return {
                exists: true,
                timestamp: Date.now(),
                tags: item.tags ? Object.keys(item.tags) : [],
                title: item.resolved_title || item.given_title
            };
        }
        return {
            exists: false,
            timestamp: Date.now(),
            tags: [],
            title: null
        };
    } catch (error) {
        console.error('Error checking Pocket status:', error);
        return null;
    }
}

// Start the popup
document.addEventListener('DOMContentLoaded', () => {
    // Setup developer mode console first
    setupDevConsole();
    
    // Then check authorization
    checkAuthorization();
}); 