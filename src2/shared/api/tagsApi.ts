/**
 * Tags API Utilities
 * 
 * This module provides functions for fetching and managing tags from Pocket
 */

import { 
  POCKET_CONSUMER_KEY, 
  API_ENDPOINTS
} from '../constants';

import { 
  storeTags, 
  setTagsLastFetch,
  getLastSyncOffset,
  setLastSyncOffset,
  removeLastSyncOffset
} from '../utils/storage';

// Pause durations
const BATCH_PAUSE = 2000; // 2 second pause between batches
const ERROR_PAUSE = 30000; // 30 second pause after rate limit error
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Fetch all user tags from Pocket
 * 
 * This robust implementation retrieves all tags across a user's entire library:
 * - Uses pagination to fetch all items
 * - Handles rate limiting and errors with retries
 * - Can resume from interruptions
 * - Saves progress as it goes
 */
export const fetchAllTags = async (accessToken: string): Promise<string[]> => {
  try {
    console.log('[TagsAPI] Starting robust tag fetch...');
    
    const tags = new Set<string>();
    let offset = 0;
    const count = 50; // Reduced from 100 to help avoid rate limits
    let hasMore = true;
    let consecutiveErrors = 0;

    // Try to resume from last offset
    const lastOffset = await getLastSyncOffset();

    // If we have a last offset, start from there
    if (lastOffset > 0) {
      offset = lastOffset;
      console.log(`[TagsAPI] Resuming sync from offset: ${offset}`);
    }

    while (hasMore) {
      try {
        console.log(`[TagsAPI] Fetching Pocket items (offset: ${offset})...`);
        const response = await fetch(API_ENDPOINTS.GET, {
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
            detailType: 'complete',  // Get full item details including tags
            state: 'all',
            sort: 'newest'
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[TagsAPI] Failed to fetch tags from Pocket, status:', response.status);
          console.error('[TagsAPI] Error response:', errorText);

          // Check if it's a rate limit error
          if (response.status === 429 || errorText.includes('rate limit')) {
            console.log('[TagsAPI] Rate limit hit, pausing for 30 seconds...');
            await new Promise(resolve => setTimeout(resolve, ERROR_PAUSE));
            consecutiveErrors++;
            
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              // Store progress before giving up
              await storeTags(Array.from(tags));
              await setLastSyncOffset(offset);
              throw new Error('Rate limit reached too many times, tag sync aborted');
            }
            
            continue; // Retry the same batch
          }

          throw new Error(`Failed to fetch tags: ${errorText}`);
        }

        const data = await response.json();
        
        // Extract unique tags from current batch of items
        if (data && data.list) {
          Object.values(data.list).forEach((item: any) => {
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
          
          // Check if we have more items to fetch
          hasMore = data && data.list && Object.keys(data.list).length === count;
          offset += count;
        } else {
          // No items or no list in response
          hasMore = false;
        }

        // Add a pause between batches to avoid rate limits
        if (hasMore) {
          console.log(`[TagsAPI] Pausing for ${BATCH_PAUSE/1000} seconds before next batch...`);
          await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE));
        }

      } catch (error) {
        console.error('[TagsAPI] Error in batch:', error);
        consecutiveErrors++;

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.log('[TagsAPI] Too many consecutive errors, stopping sync');
          // Save progress before stopping
          await storeTags(Array.from(tags));
          await setLastSyncOffset(offset);
          throw new Error('Sync stopped due to too many consecutive errors');
        }

        // Wait before retrying
        console.log(`[TagsAPI] Waiting ${ERROR_PAUSE/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, ERROR_PAUSE));
      }
    }

    // Clear the last offset since we're done
    await removeLastSyncOffset();
    
    // Update the last fetch timestamp
    await setTagsLastFetch(Date.now());

    // Convert set to array and sort alphabetically
    const sortedTags = Array.from(tags).sort();
    console.log(`[TagsAPI] Finished fetching all Pocket items. Found ${sortedTags.length} unique tags.`);
    
    return sortedTags;
  } catch (error) {
    console.error('[TagsAPI] Error fetching tags:', error);
    throw error;
  }
};

/**
 * Get tag suggestions based on current input and existing tags
 */
export const getTagSuggestions = (
  input: string,
  existingTags: string[],
  allTags: string[]
): string[] => {
  if (!input || input.length < 2) {
    return [];
  }
  
  const lowercaseInput = input.toLowerCase();
  
  // Filter tags that match the input and aren't already selected
  return allTags
    .filter(tag => 
      tag.toLowerCase().includes(lowercaseInput) && 
      !existingTags.includes(tag)
    )
    .slice(0, 5); // Limit to 5 suggestions
};