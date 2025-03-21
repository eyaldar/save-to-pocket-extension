import { POCKET_CONSUMER_KEY, POCKET_REDIRECT_URI } from './constants.js';
import { 
    setRequestToken, 
    setAccessToken, 
    removeRequestToken, 
    getLastSyncOffset, 
    storeTags, 
    setLastSyncOffset, 
    removeLastSyncOffset, getStoredTags 
} from './localStorage.js';
import { normalizeUrl } from './helpers.js';

// Authorization functions
export async function getRequestToken() {
    try {
        console.log('[PocketAPI] Requesting token with redirect URI:', POCKET_REDIRECT_URI);
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
            console.error('[PocketAPI] Request token response not OK:', response.status, errorText);
            throw new Error(`Failed to get request token: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('[PocketAPI] Received request token:', data.code);
        return data.code;
    } catch (error) {
        console.error('[PocketAPI] Error getting request token:', error);
        throw error;
    }
}

export async function getAccessToken(requestToken) {
    try {
        console.log('[PocketAPI] Requesting access token with code:', requestToken);
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
            console.error('[PocketAPI] Access token response not OK:', response.status, errorText);
            throw new Error(`Failed to get access token: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        console.log('[PocketAPI] Received access token');
        return data.access_token;
    } catch (error) {
        console.error('[PocketAPI] Error getting access token:', error);
        throw error;
    }
}

// Check if an item exists in Pocket
export async function checkPocketItemStatus(accessToken, url) {
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
                url,
                count: 100,  // Fetch 100 items
                detailType: 'complete'  // Get full item details including tags
            })
        });

        if (!response.ok) {
            console.error('Failed to check Pocket status:', response.status);
            return null;
        }

        const data = await response.json();
        const items = Object.values(data.list || {});
        
        // Find the item that matches our URL
        const matchingItem = items.find(item => {
            return normalizeUrl(item.resolved_url) === normalizeUrl(url) || normalizeUrl(item.given_url) === normalizeUrl(url);
        });

        if (matchingItem) {
            return {
                exists: true,
                timestamp: Date.now(),
                tags: matchingItem.tags ? Object.keys(matchingItem.tags) : [],
                title: matchingItem.resolved_title || matchingItem.given_title,
                itemId: matchingItem.item_id
            };
        }

        return {
            exists: false,
            timestamp: Date.now(),
            tags: [],
            title: null,
            itemId: null
        };
    } catch (error) {
        console.error('Error checking Pocket status:', error);
        return null;
    }
}

// Save URL to Pocket
export async function saveToPocket(accessToken, url, title, tags = []) {
    try {
        console.log('[PocketAPI] Saving to Pocket:', { url, title, tags });
        
        const requestBody = {
            url: url,
            title: title,
            consumer_key: POCKET_CONSUMER_KEY,
            access_token: accessToken
        };

        // Add tags if any exist
        if (tags && tags.length > 0) {
            requestBody.tags = tags.join(',');
            console.log('[PocketAPI] Adding tags:', tags);
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
            console.error('[PocketAPI] Failed to save to Pocket:', response.status, errorText);
            throw new Error(`Failed to save to Pocket: ${response.status} ${errorText}`);
        }

        const responseData = await response.json();
        console.log('[PocketAPI] Save response:', responseData);
        return responseData;
    } catch (error) {
        console.error('[PocketAPI] Error saving to Pocket:', error);
        throw error;
    }
}

// Update tags for an existing item
export async function updatePocketItemTags(accessToken, itemId, tags) {
    try {
        console.log('[PocketAPI] Updating tags for item:', { itemId, tags });
        
        const updateBody = {
            consumer_key: POCKET_CONSUMER_KEY,
            access_token: accessToken,
            actions: [{
                action: 'tags_replace',
                item_id: itemId,
                tags: tags.join(',')
            }]
        };

        console.log('[PocketAPI] Sending update request with body:', updateBody);
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
            console.error('[PocketAPI] Failed to update Pocket item:', {
                status: updateResponse.status,
                statusText: updateResponse.statusText,
                error: errorText
            });
            throw new Error(`Failed to update Pocket item: ${updateResponse.status} ${errorText}`);
        }

        const updateData = await updateResponse.json();
        console.log('[PocketAPI] Update response:', updateData);
        return updateData;
    } catch (error) {
        console.error('[PocketAPI] Error updating Pocket item tags:', error);
        throw error;
    }
}

// Fetch tags using an access token
export async function fetchAllTagsWithToken(accessToken) {
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
        const lastOffset = await getLastSyncOffset();

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
                    await setLastSyncOffset(offset + count);

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
                    await setLastSyncOffset(offset);
                    throw new Error('Sync stopped due to too many consecutive errors');
                }

                // Wait before retrying
                console.log(`Waiting ${ERROR_PAUSE/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, ERROR_PAUSE));
            }
        }

        // Clear the last offset since we're done
        await removeLastSyncOffset();

        console.log(`Finished fetching all Pocket items. Found ${tags.size} unique tags.`);
        return Array.from(tags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        throw error;
    }
}


// Get existing item from Pocket
export async function getExistingItem(accessToken, url, count = 100) {
    try {
        console.log('[PocketAPI] Fetching existing item for URL:', url);
        
        // Clean the URL - remove @ symbol and https:// prefix
        const searchUrl = url.replace(/^@/, '').replace(/^https?:\/\//, '');
        console.log('[PocketAPI] Searching with URL:', searchUrl);
        
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
                url: searchUrl,  // Search for the specific URL
                count  // Get more items to increase chance of finding the URL
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to check existing item: ${response.status}`);
        }

        const data = await response.json();
        console.log('[PocketAPI] Pocket API response status:', data.status);
        return data;
    } catch (error) {
        console.error('[PocketAPI] Error getting existing item:', error);
        throw error;
    }
} 

export async function handleAuthRequest(sender, sendResponse) {
    try {
        // Get request token
        const requestToken = await getRequestToken();
        
        // Store request token temporarily
        await setRequestToken(requestToken);
        
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
        await setAccessToken(accessToken);
        
        // Clear request token
        await removeRequestToken();
        
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
