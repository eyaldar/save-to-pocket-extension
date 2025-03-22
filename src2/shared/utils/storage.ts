import { StorageKeys } from '../constants';
import { Settings } from '../types';

// Default settings (moved here to avoid circular imports)
const DEFAULT_SETTINGS: Settings = {
  tagSuggestionsEnabled: true,
  popupCloseInterval: 3,
  devModeEnabled: false,
  tabCacheEnabled: true,
  keyboardShortcut: ''
};

// Generic storage get function
export async function get<T>(key: string, defaultValue: T): Promise<T> {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] ?? defaultValue);
    });
  });
}

// Generic storage set function
export async function set<T>(key: string, value: T): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

// Generic storage remove function
export async function remove(key: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.remove([key], resolve);
  });
}

// Auth storage functions
export const getAccessToken = async (): Promise<string | null> => {
  const result = await chrome.storage.local.get([StorageKeys.ACCESS_TOKEN]);
  return result[StorageKeys.ACCESS_TOKEN] || null;
};

export const setAccessToken = (token: string): Promise<void> => 
  set(StorageKeys.ACCESS_TOKEN, token);

export const removeAccessToken = (): Promise<void> => 
  remove(StorageKeys.ACCESS_TOKEN);

export const getRequestToken = (): Promise<string | null> => 
  get<string | null>(StorageKeys.REQUEST_TOKEN, null);

export const setRequestToken = (token: string): Promise<void> => 
  set(StorageKeys.REQUEST_TOKEN, token);

export const removeRequestToken = (): Promise<void> => 
  remove(StorageKeys.REQUEST_TOKEN);

export const getUsername = (): Promise<string | null> => 
  get<string | null>(StorageKeys.USERNAME, null);

export const setUsername = (username: string): Promise<void> => 
  set(StorageKeys.USERNAME, username);

// Tag storage functions
export async function getStoredTags(): Promise<string[]> {
  const result = await chrome.storage.local.get([StorageKeys.TAGS]);
  return result[StorageKeys.TAGS] || [];
}

export const storeTags = (tags: string[]): Promise<void> => 
  set(StorageKeys.TAGS, tags);

export const getTagsLastFetch = (): Promise<number> =>
  get<number>(StorageKeys.TAGS_LAST_FETCH, 0);

export const setTagsLastFetch = (timestamp: number): Promise<void> => 
  set(StorageKeys.TAGS_LAST_FETCH, timestamp);

// Sync offset storage functions
export const getLastSyncOffset = (): Promise<number> => 
  get<number>(StorageKeys.LAST_SYNC_OFFSET, 0);

export const setLastSyncOffset = (offset: number): Promise<void> => 
  set(StorageKeys.LAST_SYNC_OFFSET, offset);

export const removeLastSyncOffset = (): Promise<void> => 
  remove(StorageKeys.LAST_SYNC_OFFSET);

// Individual settings getters
export const getTagSuggestionsEnabled = async (): Promise<boolean> => {
  const settings = await getSettingsData();
  return settings.tagSuggestionsEnabled;
};

export const getPopupCloseInterval = async (): Promise<number> => {
  const settings = await getSettingsData();
  return settings.popupCloseInterval;
};

export const getDevModeEnabled = async (): Promise<boolean> => {
  const settings = await getSettingsData();
  return settings.devModeEnabled;
};

export const getTabCacheEnabled = async (): Promise<boolean> => {
  const settings = await getSettingsData();
  return settings.tabCacheEnabled;
};

// Settings storage functions
export async function getSettingsData(): Promise<Settings> {
  const result = await chrome.storage.local.get([StorageKeys.SETTINGS]);
  return result[StorageKeys.SETTINGS] || DEFAULT_SETTINGS;
}

// For backward compatibility
export const getSettings = getSettingsData;

export const setSettings = (settings: Settings): Promise<void> =>
  set(StorageKeys.SETTINGS, settings);

// Tab cache functions
export async function getTabCache(): Promise<any> {
  const result = await chrome.storage.local.get([StorageKeys.TAB_CACHE]);
  return result[StorageKeys.TAB_CACHE] || {};
}

export const setTabCache = (cache: any): Promise<void> =>
  set(StorageKeys.TAB_CACHE, cache);

// Keyboard shortcut functions
export async function getCurrentShortcut(): Promise<string> {
  return new Promise((resolve) => {
    chrome.commands.getAll((commands) => {
      const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
      resolve(actionCommand?.shortcut || '');
    });
  });
}

export const getStoredShortcut = (): Promise<string> => 
  get<string>(StorageKeys.KEYBOARD_SHORTCUT, '');

export const storeShortcut = (shortcut: string): Promise<void> => 
  set(StorageKeys.KEYBOARD_SHORTCUT, shortcut);

export const removeKeyboardShortcut = (): Promise<void> => 
  remove(StorageKeys.KEYBOARD_SHORTCUT); 