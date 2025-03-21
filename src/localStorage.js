import { STORAGE_KEYS } from './constants.js';

// Base storage functions
export async function get(key, defaultValue = null) {
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key] ?? defaultValue);
        });
    });
}

export async function set(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

export async function remove(key) {
    return new Promise((resolve) => {
        chrome.storage.local.remove([key], resolve);
    });
}

// Complex functions that have additional logic
export async function getTabCache() {
    return new Promise(async (resolve) => {
        // First check if tab cache is enabled
        const enabled = await get(STORAGE_KEYS.TAB_CACHE_ENABLED, false);
        if (!enabled) {
            console.log('[Background] Tab cache is disabled, returning empty cache');
            resolve({});
            return;
        }

        // If enabled, get the cache
        const cache = await get(STORAGE_KEYS.TAB_CACHE, {});
        resolve(cache);
    });
}

export async function getCurrentShortcut() {
    return new Promise((resolve) => {
        chrome.commands.getAll((commands) => {
            const actionCommand = commands.find(cmd => cmd.name === '_execute_action');
            resolve(actionCommand?.shortcut || '');
        });
    });
}

export async function getStoredTags() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.TAGS, STORAGE_KEYS.TAGS_LAST_FETCH], (result) => {
            resolve({
                tags: result[STORAGE_KEYS.TAGS] || [],
                lastFetch: result[STORAGE_KEYS.TAGS_LAST_FETCH] || 0
            });
        });
    });
}

// Backward compatibility exports
export const getStoredAccessToken = () => get(STORAGE_KEYS.ACCESS_TOKEN);
export const storeTabCache = (cache) => set(STORAGE_KEYS.TAB_CACHE, cache);
export const storeTags = (tags) => set(STORAGE_KEYS.TAGS, tags);
export const getPopupCloseInterval = () => get(STORAGE_KEYS.POPUP_CLOSE_INTERVAL, 3);
export const getDevModeEnabled = () => get(STORAGE_KEYS.DEV_MODE_ENABLED, false);
export const getTabCacheEnabled = () => get(STORAGE_KEYS.TAB_CACHE_ENABLED, false);
export const getTagSuggestionsEnabled = () => get(STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED, false);
export const setTagSuggestionsEnabled = (enabled) => set(STORAGE_KEYS.TAG_SUGGESTIONS_ENABLED, enabled);
export const getStoredShortcut = () => get(STORAGE_KEYS.KEYBOARD_SHORTCUT, '');
export const storeShortcut = (shortcut) => set(STORAGE_KEYS.KEYBOARD_SHORTCUT, shortcut);
export const setPopupCloseInterval = (seconds) => set(STORAGE_KEYS.POPUP_CLOSE_INTERVAL, seconds);
export const setDevModeEnabled = (enabled) => set(STORAGE_KEYS.DEV_MODE_ENABLED, enabled);
export const setTabCacheEnabled = (enabled) => set(STORAGE_KEYS.TAB_CACHE_ENABLED, enabled);
export const setRequestToken = (requestToken) => set(STORAGE_KEYS.REQUEST_TOKEN, requestToken);
export const getStoredRequestToken = () => get(STORAGE_KEYS.REQUEST_TOKEN);
export const setAccessToken = (accessToken) => set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
export const removeRequestToken = () => remove(STORAGE_KEYS.REQUEST_TOKEN);
export const removeAccessToken = () => remove(STORAGE_KEYS.ACCESS_TOKEN);
export const storeKeyboardShortcut = (shortcut) => set(STORAGE_KEYS.KEYBOARD_SHORTCUT, shortcut);
export const getKeyboardShortcut = () => get(STORAGE_KEYS.KEYBOARD_SHORTCUT, '');
export const removeKeyboardShortcut = () => remove(STORAGE_KEYS.KEYBOARD_SHORTCUT);
export const getLastSyncOffset = () => get(STORAGE_KEYS.LAST_SYNC_OFFSET, 0);
export const setLastSyncOffset = (offset) => set(STORAGE_KEYS.LAST_SYNC_OFFSET, offset);
export const removeLastSyncOffset = () => remove(STORAGE_KEYS.LAST_SYNC_OFFSET);