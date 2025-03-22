import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Settings } from '../types';
import { DEFAULT_SETTINGS, STORAGE_SETTINGS } from '../constants';

// Create context
const SettingsContext = createContext<{
  settings: Settings;
  updateSettings: (update: Partial<Settings>) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  isLoading: false,
  error: null
});

// Provider component
export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load settings on component mount
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const result = await chrome.storage.local.get([STORAGE_SETTINGS]);
        const storedSettings = result[STORAGE_SETTINGS] as Settings | undefined;
        
        if (storedSettings) {
          // Merge stored settings with defaults to handle any missing properties
          setSettings({
            ...DEFAULT_SETTINGS,
            ...storedSettings
          });
        }
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load settings');
        console.error('Error loading settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (update: Partial<Settings>) => {
    try {
      // Update state
      const newSettings = { ...settings, ...update };
      setSettings(newSettings);
      
      // Save to storage
      await chrome.storage.local.set({ 
        [STORAGE_SETTINGS]: newSettings 
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error saving settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to update settings');
      return Promise.reject(error);
    }
  };

  return (
    <SettingsContext.Provider 
      value={{ 
        settings, 
        updateSettings,
        isLoading,
        error
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

// Hook for using the settings context
export const useSettings = () => useContext(SettingsContext);

export default useSettings; 