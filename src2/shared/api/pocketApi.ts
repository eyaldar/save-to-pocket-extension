/**
 * Pocket API utilities
 * 
 * This module provides functions for interacting with the Pocket API:
 * - Authentication (request token, access token)
 * - Item management (add, check status, update tags)
 */

import { 
  POCKET_CONSUMER_KEY,
  POCKET_REDIRECT_URI,
  API_ENDPOINTS
} from '../constants';

import {
  setAccessToken,
  setUsername
} from '../utils/storage';

export interface PocketAddResponse {
  item: {
    item_id: string;
    normal_url: string;
    resolved_id: string;
    extended_item_id: string;
    resolved_url: string;
    domain_id: string;
    origin_domain_id: string;
    response_code: string;
    mime_type: string;
    content_length: string;
    encoding: string;
    date_resolved: string;
    date_published: string;
    title: string;
    excerpt: string;
    word_count: string;
    innerdomain_redirect: string;
    login_required: string;
    has_image: string;
    has_video: string;
    is_index: string;
    is_article: string;
    used_fallback: string;
    lang: string;
    time_first_parsed: string;
    given_url: string;
    given_title: string;
    status: string;
  };
  status: number;
}

export interface SaveItemOptions {
  url: string;
  title?: string;
  tags?: string[];
}

export interface PocketItem {
  item_id: string;
  resolved_id: string;
  given_url: string;
  given_title: string;
  favorite: string;
  status: string;
  time_added: string;
  time_updated: string;
  time_read: string;
  time_favorited: string;
  excerpt: string;
  is_article: string;
  has_video: string;
  has_image: string;
  word_count: string;
  tags?: Record<string, { item_id: string; tag: string }>;
}

export interface PocketGetResponse {
  list: Record<string, PocketItem>;
  status: number;
  complete: number;
  error?: string;
  search_meta?: {
    search_type: string;
  };
  since: number;
}

/**
 * Get a request token from Pocket API
 * First step in the OAuth process
 */
export const getRequestTokenFromApi = async (): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.REQUEST_TOKEN, {
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
    
    if (!data.code) {
      throw new Error('No request token in response');
    }
    
    return data.code;
  } catch (error) {
    console.error('Error getting request token:', error);
    throw error;
  }
};

/**
 * Exchange a request token for an access token
 * Final step in the OAuth process
 */
export const getAccessTokenFromApi = async (requestToken: string): Promise<string> => {
  try {
    const response = await fetch(API_ENDPOINTS.AUTHORIZE, {
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
    
    if (!data.access_token) {
      throw new Error('No access token in response');
    }
    
    // Store the access token
    await setAccessToken(data.access_token);
    await setUsername(data.username);
    
    return data.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
};

/**
 * Check if a URL is already saved in the user's Pocket
 */
export const checkPocketItemStatus = async (accessToken: string, url: string): Promise<any> => {
  try {
    const response = await fetch(API_ENDPOINTS.GET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json'
      },
      body: JSON.stringify({
        consumer_key: POCKET_CONSUMER_KEY,
        access_token: accessToken,
        state: 'all',
        detailType: 'simple',
        search: url
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PocketAPI] Check URL status response not OK:', response.status, errorText);
      throw new Error(`Failed to check URL status: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const items = data.list || {};
    
    // Find the item with matching URL if it exists
    for (const itemId in items) {
      const item = items[itemId];
      if (item.resolved_url === url || item.given_url === url) {
        return {
          exists: true,
          itemId: itemId,
          ...item
        };
      }
    }
    
    return { exists: false };
  } catch (error) {
    console.error('Error checking URL status:', error);
    throw error;
  }
};

/**
 * Save a URL to Pocket
 */
export const saveToPocket = async (
  accessToken: string,
  url: string,
  title?: string,
  tags: string[] = []
): Promise<any> => {
  try {
    const payload = {
      url,
      consumer_key: POCKET_CONSUMER_KEY,
      access_token: accessToken,
      ...(title && { title }),
      ...(tags.length > 0 && { tags: tags.join(',') })
    };

    const response = await fetch(API_ENDPOINTS.ADD, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PocketAPI] Save to Pocket response not OK:', response.status, errorText);
      throw new Error(`Failed to save to Pocket: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error saving to Pocket:', error);
    throw error;
  }
};

/**
 * Update tags for a Pocket item
 */
export const updatePocketItemTags = async (
  accessToken: string,
  itemId: string,
  tags: string[]
): Promise<any> => {
  try {
    // Create the tags action
    const action = {
      action: 'tags_replace',
      item_id: itemId,
      tags: tags.join(',')
    };

    const requestData = {
      consumer_key: POCKET_CONSUMER_KEY,
      access_token: accessToken,
      actions: [action]
    };

    const response = await fetch(API_ENDPOINTS.SEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PocketAPI] Update tags response not OK:', response.status, errorText);
      throw new Error(`Failed to update tags: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating tags:', error);
    throw error;
  }
};

class PocketApi {
  private async getAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['access_token'], result => {
        const token = result['access_token'];
        if (token) {
          resolve(token);
        } else {
          reject(new Error('Not authenticated'));
        }
      });
    });
  }

  private async getUsername(): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['username'], result => {
        const username = result['username'];
        if (username) {
          resolve(username);
        } else {
          reject(new Error('Username not found'));
        }
      });
    });
  }

  async saveItem({ url, title, tags = [] }: SaveItemOptions): Promise<PocketAddResponse> {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      url,
      consumer_key: POCKET_CONSUMER_KEY,
      access_token: accessToken,
      ...(title && { title }),
      ...(tags.length > 0 && { tags: tags.join(',') })
    };

    const response = await fetch(API_ENDPOINTS.ADD, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PocketAPI] Save item response not OK:', response.status, errorText);
      throw new Error(`Failed to save item: ${errorText}`);
    }

    return await response.json();
  }

  async getTags(): Promise<string[]> {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      consumer_key: POCKET_CONSUMER_KEY,
      access_token: accessToken,
      state: 'all',
      detailType: 'complete'
    };

    const response = await fetch(API_ENDPOINTS.GET, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PocketAPI] Get tags response not OK:', response.status, errorText);
      throw new Error(`Failed to fetch items: ${errorText}`);
    }

    const data: PocketGetResponse = await response.json();
    
    // Extract unique tags from items
    const tags = new Set<string>();
    
    if (data.list) {
      Object.values(data.list).forEach(item => {
        if (item.tags) {
          Object.values(item.tags).forEach(tagObj => {
            tags.add(tagObj.tag);
          });
        }
      });
    }
    
    return Array.from(tags).sort();
  }

  async getTagSuggestions(url: string, title: string): Promise<string[]> {
    try {
      // This is a simplistic approach - in a real implementation,
      // we would call an external API for content-based suggestions
      // For now, extract keywords from the title and URL
      const combined = `${title} ${url}`;
      const words = combined
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !['http', 'https', 'www'].includes(word));
      
      // Remove duplicates and sort by length (longer words first)
      const uniqueWords = Array.from(new Set(words))
        .sort((a, b) => b.length - a.length)
        .slice(0, 5); // Limit to 5 suggestions
      
      return uniqueWords;
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
      return [];
    }
  }

  async updateTags(itemId: string, tags: string[]): Promise<void> {
    const accessToken = await this.getAccessToken();
    
    const payload = {
      actions: [
        {
          action: 'tags_replace',
          item_id: itemId,
          tags: tags.join(',')
        }
      ],
      consumer_key: POCKET_CONSUMER_KEY,
      access_token: accessToken
    };

    const response = await fetch(API_ENDPOINTS.SEND, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PocketAPI] Update tags response not OK:', response.status, errorText);
      throw new Error(`Failed to update tags: ${errorText}`);
    }
  }
}

export const pocketApi = new PocketApi(); 