import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { 
  pocketApi,
  PocketAddResponse
} from '../api/pocketApi';

interface SaveItemOptions {
  url: string;
  title: string;
  tags?: string[];
  favorite?: boolean;
}

interface PocketApiState {
  isSaving: boolean;
  saveError: string | null;
}

// Default state
const defaultPocketApiState: PocketApiState = {
  isSaving: false,
  saveError: null
};

// Create a dummy response object that matches the interface
const dummyResponse: PocketAddResponse = {
  item: {
    item_id: '',
    normal_url: '',
    resolved_id: '',
    extended_item_id: '',
    resolved_url: '',
    domain_id: '',
    origin_domain_id: '',
    response_code: '',
    mime_type: '',
    content_length: '',
    encoding: '',
    date_resolved: '',
    date_published: '',
    title: '',
    excerpt: '',
    word_count: '',
    innerdomain_redirect: '',
    login_required: '',
    has_image: '',
    has_video: '',
    is_index: '',
    is_article: '',
    used_fallback: '',
    lang: '',
    time_first_parsed: '',
    given_url: '',
    given_title: '',
    status: ''
  },
  status: 0
};

// Create context
const PocketApiContext = createContext<{
  isSaving: boolean;
  saveError: string | null;
  saveItem: (options: SaveItemOptions) => Promise<PocketAddResponse>;
  clearError: () => void;
  getTags: () => Promise<string[]>;
  getTagSuggestions: (url: string, title: string) => Promise<string[]>;
}>({
  isSaving: false,
  saveError: null,
  saveItem: async () => dummyResponse,
  clearError: () => {},
  getTags: async () => [],
  getTagSuggestions: async () => []
});

// Provider component
export const PocketApiProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PocketApiState>(defaultPocketApiState);
  const { auth } = useAuth();

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, saveError: null }));
  }, []);

  const saveItem = useCallback(async (options: SaveItemOptions): Promise<PocketAddResponse> => {
    if (!auth.isAuthenticated || !auth.accessToken) {
      const error = 'User is not authenticated';
      setState(prev => ({ ...prev, saveError: error }));
      throw new Error(error);
    }

    try {
      setState(prev => ({ ...prev, isSaving: true, saveError: null }));

      const { url, title, tags = [], favorite = false } = options;
      
      // Save the item to Pocket using the pocketApi class
      return await pocketApi.saveItem({ url, title, tags });
    } catch (error) {
      console.error('Error saving to Pocket:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save to Pocket';
      setState(prev => ({ ...prev, isSaving: false, saveError: errorMessage }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isSaving: false }));
    }
  }, [auth.isAuthenticated, auth.accessToken]);

  // Get all tags from the user's Pocket
  const getTags = useCallback(async (): Promise<string[]> => {
    if (!auth.isAuthenticated || !auth.accessToken) {
      throw new Error('User is not authenticated');
    }
    
    try {
      return await pocketApi.getTags();
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }
  }, [auth.isAuthenticated, auth.accessToken]);

  // Get tag suggestions based on content
  const getTagSuggestions = useCallback(async (url: string, title: string): Promise<string[]> => {
    if (!auth.isAuthenticated) {
      return [];
    }
    
    try {
      return await pocketApi.getTagSuggestions(url, title);
    } catch (error) {
      console.error('Error getting tag suggestions:', error);
      return [];
    }
  }, [auth.isAuthenticated]);

  return (
    <PocketApiContext.Provider 
      value={{ 
        isSaving: state.isSaving, 
        saveError: state.saveError, 
        saveItem,
        clearError,
        getTags,
        getTagSuggestions
      }}
    >
      {children}
    </PocketApiContext.Provider>
  );
};

// Hook for using the pocket API context
export const usePocketApi = () => useContext(PocketApiContext); 