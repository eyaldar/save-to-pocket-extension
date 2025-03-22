/**
 * Application constants
 */

// Pocket API configuration
export const POCKET_CONSUMER_KEY = '114159-ad4865edea00db98dbb760e';
export const POCKET_REDIRECT_URI = chrome.identity.getRedirectURL();

// API Endpoints
export const POCKET_API_URL = 'https://getpocket.com/v3';
export const POCKET_ADD_ENDPOINT = '/add';
export const POCKET_GET_ENDPOINT = '/get';
export const POCKET_SEND_ENDPOINT = '/send';
export const POCKET_OAUTH_REQUEST_ENDPOINT = '/oauth/request';
export const POCKET_OAUTH_AUTHORIZE_ENDPOINT = '/oauth/authorize';

// Full API URLs
export const API_ENDPOINTS = {
  REQUEST_TOKEN: `${POCKET_API_URL}${POCKET_OAUTH_REQUEST_ENDPOINT}`,
  AUTHORIZE: `${POCKET_API_URL}${POCKET_OAUTH_AUTHORIZE_ENDPOINT}`,
  GET: `${POCKET_API_URL}${POCKET_GET_ENDPOINT}`,
  ADD: `${POCKET_API_URL}${POCKET_ADD_ENDPOINT}`,
  SEND: `${POCKET_API_URL}${POCKET_SEND_ENDPOINT}`
};

// Storage Keys as enum for TypeScript type safety
export enum StorageKeys {
  TAGS = 'pocket_tags',
  TAGS_LAST_FETCH = 'pocket_tags_last_fetch',
  TAG_SUGGESTIONS_ENABLED = 'tag_suggestions_enabled',
  ACCESS_TOKEN = 'access_token',
  USERNAME = 'username',
  LAST_SYNC_OFFSET = 'pocket_last_sync_offset',
  KEYBOARD_SHORTCUT = 'keyboard_shortcut',
  REQUEST_TOKEN = 'request_token',
  POPUP_CLOSE_INTERVAL = 'popup_close_interval',
  DEV_MODE_ENABLED = 'dev_mode_enabled',
  TAB_CACHE = 'pocket_tab_cache',
  TAB_CACHE_ENABLED = 'tab_cache_enabled',
  SETTINGS = 'pocket_settings',
  TAGS_TIMESTAMP = 'pocket_tags_timestamp'
}

// Legacy object-based storage keys for backward compatibility
export const STORAGE_KEYS = {
  ACCESS_TOKEN: StorageKeys.ACCESS_TOKEN,
  REQUEST_TOKEN: StorageKeys.REQUEST_TOKEN,
  USERNAME: StorageKeys.USERNAME,
  SETTINGS: StorageKeys.SETTINGS,
  TAGS: StorageKeys.TAGS,
  TAGS_LAST_FETCH: StorageKeys.TAGS_LAST_FETCH,
  TAGS_TIMESTAMP: StorageKeys.TAGS_TIMESTAMP,
  TAB_CACHE: StorageKeys.TAB_CACHE
};

// Cache durations in milliseconds
export const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
export const CACHE_DURATION_TAGS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting configuration
export const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
export const MAX_CALLS_PER_HOUR = 320; // Pocket's limit per hour
export const MIN_SYNC_INTERVAL = 12 * 60 * 60 * 1000; // 12 hours

// Default settings
export const DEFAULT_SETTINGS = {
  popupCloseInterval: 3, // seconds
  devModeEnabled: false,
  tagSuggestionsEnabled: true,
  tabCacheEnabled: true,
  keyboardShortcut: 'Ctrl+Shift+P'
};

// Message Types
export const MESSAGE_TYPES = {
  AUTHENTICATE: 'authenticate',
  CHECK_AUTH: 'check_auth',
  CHECK_URL: 'check_url',
  SAVE_URL: 'save_url',
  ADD_TAGS: 'add_tags',
  REQUEST_TAG_SYNC: 'request_tag_sync',
  GET_TAB: 'get_tab',
  SAVE_PAGE: 'save_page',
  AUTH_COMPLETE: 'auth_complete',
  AUTH_ERROR: 'auth_error'
};

// Alarm Names
export const ALARM_NAMES = {
  TAG_SYNC: 'tag_sync'
};

// API configuration
export const CONSUMER_KEY = 'your-consumer-key'; // Replace with your actual key in a real implementation

// Storage keys
export const STORAGE_ACCESS_TOKEN = 'pocket_access_token';
export const STORAGE_REQUEST_TOKEN = 'pocket_request_token';
export const STORAGE_USERNAME = 'pocket_username';
export const STORAGE_SETTINGS = 'pocket_settings';
export const STORAGE_TAGS_CACHE = 'pocket_tags_cache'; 