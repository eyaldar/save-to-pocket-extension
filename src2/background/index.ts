/**
 * Background script for Save to Pocket extension
 * 
 * This script provides the main functionality for the extension:
 * - Authenticating with Pocket
 * - Handling messages from the popup
 * - Saving items to Pocket
 * - Syncing tags from Pocket
 * - Rate limiting API calls to avoid hitting limits
 */

import { 
  MESSAGE_TYPES, 
  ALARM_NAMES,
  RATE_LIMIT_WINDOW,
  MAX_CALLS_PER_HOUR 
} from '../shared/constants';

import {
  checkPocketItemStatus,
  getRequestTokenFromApi,
  getAccessTokenFromApi,
  saveToPocket,
  updatePocketItemTags
} from '../shared/api/pocketApi';

import { 
  getAccessToken, 
  storeTags,
  setTagsLastFetch,
  setRequestToken,
  removeRequestToken,
  setUsername
} from '../shared/utils/storage';

import { fetchAllTags } from '../shared/api/tagsApi';
import { POCKET_REDIRECT_URI, POCKET_CONSUMER_KEY } from '../shared/constants';

// Track API calls for rate limiting
let apiCallTimestamps: number[] = [];

// Check if we're within rate limits
function isWithinRateLimit(): boolean {
  const now = Date.now();
  // Remove timestamps older than the rate limit window
  apiCallTimestamps = apiCallTimestamps.filter(timestamp => 
    now - timestamp < RATE_LIMIT_WINDOW
  );
  
  // Check if we've made less than the max calls in the window
  return apiCallTimestamps.length < MAX_CALLS_PER_HOUR;
}

// Record an API call for rate limiting
function recordApiCall(): void {
  apiCallTimestamps.push(Date.now());
}

// Authentication handler - similar to the legacy implementation
async function initiateAuth(): Promise<{success: boolean, accessToken?: string, error?: string}> {
  try {
    // Get request token
    const requestToken = await getRequestTokenFromApi();
    
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
    const accessToken = await getAccessTokenFromApi(requestToken);
    
    // Clear request token
    await removeRequestToken();
    
    // Broadcast auth completion
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.AUTH_COMPLETE,
      accessToken: accessToken
    });
    
    return { success: true, accessToken };
  } catch (error) {
    console.error('[Background] Error during auth:', error);
    
    // Broadcast auth error
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.AUTH_ERROR,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during authentication'
    };
  }
}

// Message handler for the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] Message received:', message);

  // Handle different message types
  switch (message.type) {
    case MESSAGE_TYPES.AUTHENTICATE:
      initiateAuth().then(sendResponse).catch(error => {
        console.error('[Background] Authentication error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Indicate async response

    case MESSAGE_TYPES.CHECK_URL:
      checkUrl(message.url, message.accessToken)
        .then(sendResponse)
        .catch(error => {
          console.error('[Background] Check URL error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case MESSAGE_TYPES.SAVE_URL:
      saveUrl(
        message.accessToken,
        message.url,
        message.title,
        message.tags
      )
        .then(sendResponse)
        .catch(error => {
          console.error('[Background] Save URL error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case MESSAGE_TYPES.ADD_TAGS:
      updateTags(
        message.accessToken,
        message.itemId,
        message.tags
      )
        .then(sendResponse)
        .catch(error => {
          console.error('[Background] Add tags error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case MESSAGE_TYPES.REQUEST_TAG_SYNC:
      syncTags()
        .then(sendResponse)
        .catch(error => {
          console.error('[Background] Tag sync error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case MESSAGE_TYPES.SAVE_PAGE:
      savePage(message.url, message.title)
        .then(sendResponse)
        .catch(error => {
          console.error('[Background] Save page error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true;
  }
});

// Check URL status in Pocket
async function checkUrl(url: string, accessToken: string) {
  try {
    if (!isWithinRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    recordApiCall();
    const status = await checkPocketItemStatus(accessToken, url);
    return { success: true, status };
  } catch (error) {
    console.error('[Background] Error checking URL:', error);
    throw error;
  }
}

// Save URL to Pocket
async function saveUrl(accessToken: string, url: string, title?: string, tags: string[] = []) {
  try {
    if (!isWithinRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    recordApiCall();
    const result = await saveToPocket(accessToken, url, title, tags);
    return { success: true, result };
  } catch (error) {
    console.error('[Background] Error saving URL:', error);
    throw error;
  }
}

// Update tags for a Pocket item
async function updateTags(accessToken: string, itemId: string, tags: string[]) {
  try {
    if (!isWithinRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    recordApiCall();
    const result = await updatePocketItemTags(accessToken, itemId, tags);
    return { success: true, result };
  } catch (error) {
    console.error('[Background] Error updating tags:', error);
    throw error;
  }
}

// Sync tags from Pocket
async function syncTags() {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error('Not authenticated');
    }
    
    // Check rate limits before making API call
    if (!isWithinRateLimit()) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Record this API call
    recordApiCall();
    
    console.log('[Background] Syncing tags...');
    const tags = await fetchAllTags(accessToken);
    
    // Store tags locally
    await storeTags(tags);
    await setTagsLastFetch(Date.now());
    
    console.log(`[Background] Synced ${tags.length} tags`);
    return { success: true, count: tags.length };
  } catch (error) {
    console.error('[Background] Tag sync error:', error);
    throw error;
  }
}

// Save the current page
async function savePage(url: string, title: string) {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      // If not authenticated, open the popup
      chrome.action.openPopup();
      return { success: false, error: 'Authentication required' };
    }
    
    // Save to Pocket
    const result = await saveToPocket(accessToken, url, title);
    return { success: true, item: result.item };
  } catch (error) {
    console.error('[Background] Save page error:', error);
    throw error;
  }
}

// Set up scheduled tag sync
chrome.alarms.create(ALARM_NAMES.TAG_SYNC, {
  periodInMinutes: 60 * 24 // Once a day
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAMES.TAG_SYNC) {
    syncTags().catch(console.error);
  }
});

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Background] Extension installed/updated');
  
  // Check if already authenticated
  const accessToken = await getAccessToken();
  if (accessToken) {
    // Sync tags on install if authenticated
    syncTags().catch(console.error);
  }
}); 