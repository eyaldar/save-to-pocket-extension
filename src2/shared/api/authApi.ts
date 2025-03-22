import { POCKET_CONSUMER_KEY, POCKET_REDIRECT_URI } from '../constants';
import { setAccessToken, setRequestToken, getRequestToken, removeRequestToken } from '../utils/storage';
import { getRequestTokenFromApi, getAccessTokenFromApi } from './pocketApi';

/**
 * Initiates the Pocket OAuth flow
 * @returns A promise that resolves when authorization is complete
 */
export async function initializeAuth(): Promise<{ success: boolean; error?: string }> {
  try {
    // Get request token
    const requestToken = await getRequestTokenFromApi();
    
    // Store request token temporarily
    await setRequestToken(requestToken);
    
    // Open Pocket authorization page
    const authUrl = `https://getpocket.com/auth/authorize?request_token=${requestToken}&redirect_uri=${encodeURIComponent(POCKET_REDIRECT_URI)}`;
    console.log('[Auth] Launching auth flow with URL:', authUrl);
    
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });
    
    if (!redirectUrl) {
      throw new Error('Authorization flow was cancelled or failed');
    }
    
    console.log('[Auth] Received redirect URL:', redirectUrl);
    
    // Get stored request token
    const storedRequestToken = await getRequestToken();
    if (!storedRequestToken) {
      throw new Error('No request token found');
    }

    // Get access token
    const accessToken = await getAccessTokenFromApi(storedRequestToken);
    
    // Store the access token
    await setAccessToken(accessToken);
    
    // Clear request token
    await removeRequestToken();
    
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error during auth:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error during authentication'
    };
  }
}

/**
 * Handles the OAuth callback
 * @param url - The callback URL
 * @returns A promise that resolves when the access token is obtained
 */
export async function handleAuthCallback(url: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get stored request token
    const requestToken = await getRequestToken();
    if (!requestToken) {
      throw new Error('No request token found');
    }

    // Get access token
    const accessToken = await getAccessTokenFromApi(requestToken);
    
    // Store the access token
    await setAccessToken(accessToken);
    
    // Clear request token
    await removeRequestToken();
    
    return { success: true };
  } catch (error) {
    console.error('[Auth] Error handling OAuth callback:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error handling callback'
    };
  }
} 