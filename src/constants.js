// Pocket API configuration
export const POCKET_CONSUMER_KEY = '114159-ad4865edea00db98dbb760e';
export const POCKET_REDIRECT_URI = chrome.identity.getRedirectURL();

// Storage keys
export const STORAGE_KEYS = {
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
    TAB_CACHE: 'tab_cache',
    TAB_CACHE_ENABLED: 'tab_cache_enabled'  // New key for tab cache feature
};

// Cache duration in milliseconds (5 hours)
export const CACHE_DURATION = 5 * 60 * 60 * 1000;

// Rate limiting configuration
export const MAX_CALLS_PER_HOUR = 20;
export const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
export const MIN_SYNC_INTERVAL = RATE_LIMIT_WINDOW / MAX_CALLS_PER_HOUR; // Minimum time between syncs