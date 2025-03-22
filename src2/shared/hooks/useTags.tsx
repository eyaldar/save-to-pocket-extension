import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { usePocketApi } from './usePocketApi';
import { CACHE_DURATION_TAGS } from '../constants';

// Define the TagsState interface inline to avoid import issues
interface TagsState {
  tags: string[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

// Default state
const defaultTagsState: TagsState = {
  tags: [],
  isLoading: false,
  error: null,
  lastUpdated: null
};

// Create context
const TagsContext = createContext<{
  tagsState: TagsState;
  refreshTags: () => Promise<void>;
  filterTags: (input: string) => string[];
  addTag: (tag: string) => Promise<void>;
  getContentSuggestions: (url: string, title: string) => Promise<string[]>;
}>({
  tagsState: defaultTagsState,
  refreshTags: async () => {},
  filterTags: () => [],
  addTag: async () => {},
  getContentSuggestions: async () => []
});

// Provider component
export const TagsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tagsState, setTagsState] = useState<TagsState>(defaultTagsState);
  const { auth } = useAuth();
  const { getTags, getTagSuggestions } = usePocketApi();

  // Fetch tags from the API
  const refreshTags = useCallback(async () => {
    // Skip if already loading or not authenticated
    if (tagsState.isLoading || !auth.isAuthenticated) return;
    
    // Check cache - only refresh if older than CACHE_DURATION_TAGS
    const now = Date.now();
    if (
      tagsState.lastUpdated && 
      now - tagsState.lastUpdated < CACHE_DURATION_TAGS
    ) {
      return;
    }

    setTagsState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const tags = await getTags();
      setTagsState({
        tags,
        isLoading: false,
        error: null,
        lastUpdated: Date.now()
      });
      
      // Store tags in local storage for offline use
      localStorage.setItem('pocket_tags', JSON.stringify(tags));
      localStorage.setItem('pocket_tags_timestamp', Date.now().toString());
      
    } catch (error) {
      setTagsState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tags'
      }));
      console.error('Error fetching tags:', error);
    }
  }, [getTags, auth.isAuthenticated, tagsState.isLoading, tagsState.lastUpdated]);

  // Filter tags based on input
  const filterTags = useCallback((input: string): string[] => {
    if (!input || input.trim() === '') return [];
    
    const normalizedInput = input.toLowerCase().trim();
    return tagsState.tags
      .filter(tag => tag.toLowerCase().includes(normalizedInput))
      .sort((a, b) => {
        // Sort exact matches first, then by alphabetical order
        const aStartsWith = a.toLowerCase().startsWith(normalizedInput);
        const bStartsWith = b.toLowerCase().startsWith(normalizedInput);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 8); // Limit to 8 suggestions
  }, [tagsState.tags]);

  // Add a new tag
  const addTag = async (tag: string) => {
    if (!tag || tag.trim() === '') return;
    
    // If tag already exists, do nothing
    if (tagsState.tags.includes(tag)) return;
    
    try {
      // Add to local state
      const updatedTags = [...tagsState.tags, tag];
      setTagsState({
        ...tagsState,
        tags: updatedTags,
        lastUpdated: Date.now()
      });
      
      // Store in local storage for offline use
      localStorage.setItem('pocket_tags', JSON.stringify(updatedTags));
      localStorage.setItem('pocket_tags_timestamp', Date.now().toString());
    } catch (error) {
      console.error('Error adding new tag:', error);
    }
  };

  // Get content-based tag suggestions
  const getContentSuggestions = useCallback(async (url: string, title: string): Promise<string[]> => {
    try {
      return await getTagSuggestions(url, title);
    } catch (error) {
      console.error('Error getting content suggestions:', error);
      return [];
    }
  }, [getTagSuggestions]);

  // Load cached tags on mount
  useEffect(() => {
    const loadCachedTags = () => {
      try {
        const cachedTags = localStorage.getItem('pocket_tags');
        const timestamp = localStorage.getItem('pocket_tags_timestamp');
        
        if (cachedTags) {
          const tags = JSON.parse(cachedTags);
          setTagsState(prev => ({
            ...prev,
            tags,
            lastUpdated: timestamp ? parseInt(timestamp, 10) : null
          }));
        }
      } catch (error) {
        console.error('Error loading cached tags:', error);
      }
    };

    loadCachedTags();
  }, []);

  // Refresh tags when auth changes or on mount
  useEffect(() => {
    if (auth.isAuthenticated) {
      refreshTags();
    }
  }, [auth.isAuthenticated, refreshTags]);

  return (
    <TagsContext.Provider value={{ 
      tagsState, 
      refreshTags, 
      filterTags, 
      addTag,
      getContentSuggestions 
    }}>
      {children}
    </TagsContext.Provider>
  );
};

// Hook for using the tags context
export const useTags = () => useContext(TagsContext);

export default useTags; 