import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { useSettings } from './useSettings';
import { STORAGE_KEYS } from '../constants';

export interface TabInfo {
  id?: number;
  url?: string;
  title?: string;
  favIconUrl?: string;
  description?: string;
  lastUpdated?: number;
}

interface TabState {
  tab: TabInfo | null;
  isLoading: boolean;
  error: string | null;
}

interface TabContextValue {
  tabState: TabState;
  refreshTabInfo: () => Promise<TabInfo | null>;
  getTabCache: () => Promise<Record<number, TabInfo>>;
  updateTabCache: (tabInfo: TabInfo) => Promise<void>;
  clearTabCache: () => Promise<void>;
}

const TabContext = createContext<TabContextValue>({
  tabState: {
    tab: null,
    isLoading: false,
    error: null
  },
  refreshTabInfo: async () => null,
  getTabCache: async () => ({}),
  updateTabCache: async () => {},
  clearTabCache: async () => {}
});

export const TabProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [tabState, setTabState] = useState<TabState>({
    tab: null,
    isLoading: true,
    error: null
  });

  // Get the tab cache from storage
  const getTabCache = async (): Promise<Record<number, TabInfo>> => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_CACHE);
      return result[STORAGE_KEYS.TAB_CACHE] || {};
    } catch (error) {
      console.error('Error getting tab cache:', error);
      return {};
    }
  };

  // Update the tab cache with new tab info
  const updateTabCache = async (tabInfo: TabInfo): Promise<void> => {
    if (!settings.tabCacheEnabled || !tabInfo.id) return;
    
    try {
      const cache = await getTabCache();
      
      // Update the cache with the new tab info
      cache[tabInfo.id] = {
        ...tabInfo,
        lastUpdated: Date.now()
      };
      
      // Store the updated cache
      await chrome.storage.local.set({ [STORAGE_KEYS.TAB_CACHE]: cache });
    } catch (error) {
      console.error('Error updating tab cache:', error);
    }
  };

  // Clear the tab cache
  const clearTabCache = async (): Promise<void> => {
    try {
      await chrome.storage.local.remove(STORAGE_KEYS.TAB_CACHE);
    } catch (error) {
      console.error('Error clearing tab cache:', error);
    }
  };

  // Get info about the active tab
  const getCurrentTab = useCallback(async (): Promise<TabInfo | null> => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        throw new Error('No active tab found');
      }

      const activeTab = tabs[0];
      let tabInfo: TabInfo = {
        id: activeTab.id,
        url: activeTab.url,
        title: activeTab.title,
        favIconUrl: activeTab.favIconUrl,
        // We'll use the title as description if no cached description exists
        description: activeTab.title
      };
      
      // Try to get cached tab info first
      if (settings.tabCacheEnabled && activeTab.id) {
        const cache = await getTabCache();
        if (cache[activeTab.id]) {
          // Use cached info and update with fresh data
          tabInfo = { ...cache[activeTab.id], ...tabInfo };
        }
      }
      
      // Update the cache
      await updateTabCache(tabInfo);
      
      return tabInfo;
    } catch (error) {
      console.error('Error getting current tab:', error);
      return null;
    }
  }, [settings.tabCacheEnabled]);

  // Refresh tab info (can be called externally)
  const refreshTabInfo = useCallback(async (): Promise<TabInfo | null> => {
    setTabState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const tabInfo = await getCurrentTab();
      
      if (!tabInfo) {
        throw new Error('Failed to get tab information');
      }
      
      setTabState({
        tab: tabInfo,
        isLoading: false,
        error: null
      });
      
      return tabInfo;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTabState({
        tab: null,
        isLoading: false,
        error: errorMessage
      });
      return null;
    }
  }, [getCurrentTab]);

  // Clear tab cache when disabled in settings
  useEffect(() => {
    if (!settings.tabCacheEnabled) {
      clearTabCache();
    }
  }, [settings.tabCacheEnabled]);

  // Get tab info on mount
  useEffect(() => {
    refreshTabInfo();
  }, [refreshTabInfo]);

  return (
    <TabContext.Provider value={{ 
      tabState, 
      refreshTabInfo, 
      getTabCache, 
      updateTabCache, 
      clearTabCache 
    }}>
      {children}
    </TabContext.Provider>
  );
};

export const useTab = (): TabContextValue => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error('useTab must be used within a TabProvider');
  }
  return context;
};

export default useTab; 