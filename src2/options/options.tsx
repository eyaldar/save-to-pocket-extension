import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useAuth, useSettings } from '../shared/hooks';
import { DEFAULT_SETTINGS, MESSAGE_TYPES } from '../shared/constants';
import { Providers } from '../shared/providers/Providers';

const OptionsPage: React.FC = () => {
  const { auth, logout, refreshAuth } = useAuth();
  const { settings, updateSettings } = useSettings();
  const [status, setStatus] = useState<string>('');
  const [keyboardShortcut, setKeyboardShortcut] = useState<string>('');
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('success');
  const statusTimeoutRef = useRef<number | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Load current keyboard shortcut
  const loadKeyboardShortcut = () => {
    chrome.commands.getAll((commands) => {
      const saveCommand = commands.find(command => command.name === 'open-pocket-saver');
      if (saveCommand && saveCommand.shortcut) {
        setKeyboardShortcut(saveCommand.shortcut);
      }
    });
  };

  useEffect(() => {
    loadKeyboardShortcut();
    
    // We can't directly listen for command changes, but we can check periodically
    const intervalId = setInterval(loadKeyboardShortcut, 5000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Handle toggle changes
  const handleToggleChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ [key]: e.target.checked });
    showStatus('Options saved');
  };

  // Handle number input changes
  const handleNumberChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      updateSettings({ [key]: value });
      showStatus('Options saved');
    }
  };

  // Show status message
  const showStatus = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setStatus(message);
    setStatusType(type);
    
    // Clear any existing timeout
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
    }
    
    // Hide status after 3 seconds
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatus('');
    }, 3000);
  };

  // Open keyboard shortcuts page
  const openShortcutSettings = () => {
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  // Handle disconnecting from Pocket
  const handleDisconnect = async () => {
    if (window.confirm('Are you sure you want to disconnect from Pocket? You will need to authorize again to use this extension.')) {
      await logout();
      showStatus('Disconnected from Pocket', 'info');
    }
  };

  // Handle connecting to Pocket
  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      showStatus('Connecting to Pocket...', 'info');
      
      // Use the background script to handle authentication
      const response = await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.AUTHENTICATE
      });
      
      setIsConnecting(false);
      
      if (response && response.success) {
        showStatus('Connected to Pocket successfully!', 'success');
        // Use refreshAuth to update the auth state without reloading
        await refreshAuth();
      } else {
        showStatus(response?.error || 'Failed to connect to Pocket', 'error');
      }
    } catch (error) {
      setIsConnecting(false);
      showStatus(error instanceof Error ? error.message : 'An error occurred', 'error');
    }
  };

  // Reset all settings to defaults
  const resetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      updateSettings(DEFAULT_SETTINGS);
      showStatus('Settings reset to defaults');
    }
  };

  return (
    <div className="options-container">
      <h1 className="options-heading text-2xl font-bold mb-6">Save to Pocket Options</h1>
      
      {/* Status message */}
      {status && (
        <div className={`status-message status-${statusType.toLowerCase()} mb-4`}>
          {status}
        </div>
      )}
      
      <div className="mb-6">
        <h2 className="options-section text-lg font-medium mb-4">Account Settings</h2>
        
        <div className="option-group">
          <div className="option-title">Pocket Connection</div>
          <div className="option-description">
            Connect your Pocket account to enable tag suggestions and other features.
          </div>
          
          <div className={`status ${auth.isAuthenticated ? 'connected' : 'disconnected'} mt-2 mb-2`}>
            {auth.isAuthenticated 
              ? `Connected to Pocket as ${auth.username || 'Unknown User'}` 
              : 'Not connected to Pocket'}
          </div>
          
          {auth.isAuthenticated ? (
            <button
              onClick={handleDisconnect}
              className="pocket-button"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              className="pocket-button"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <span className="spinner inline-block mr-2"></span>
                  Connecting...
                </>
              ) : (
                'Connect to Pocket'
              )}
            </button>
          )}
        </div>
      </div>
    
      <div className="mb-6">
        <h2 className="options-section text-lg font-medium mb-4">Features</h2>
        
        {/* Tag suggestions */}
        <div className="option-group">
          <div className="option-title">Tag Suggestions</div>
          <div className="option-description">
            Enable tag suggestions based on your existing Pocket tags when saving items.
          </div>
          <div className="flex items-center mt-3">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.tagSuggestionsEnabled}
                onChange={handleToggleChange('tagSuggestionsEnabled')}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="ml-2 text-sm text-gray-700">
              {settings.tagSuggestionsEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        
        {/* Tab cache */}
        <div className="option-group">
          <div className="option-title">Tab Cache</div>
          <div className="option-description">
            Cache tab information to reduce API calls to Pocket and improve performance.
          </div>
          <div className="flex items-center mt-3">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.tabCacheEnabled}
                onChange={handleToggleChange('tabCacheEnabled')}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="ml-2 text-sm text-gray-700">
              {settings.tabCacheEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        
        <div className="rate-limit-explanation">
          <p className="rate-limit-info">
            <strong>Note about rate limits:</strong> The tag suggestions feature is limited to 20 API calls per hour due to Pocket's API rate limits. 
            This means that after 20 calls in an hour, new tag suggestions will only be fetched when the rate limit resets. 
            While tab cache is not strictly limited, it's good to keep in mind that all Pocket API calls count towards this limit.
          </p>
        </div>
        
        {/* Developer mode */}
        <div className="option-group">
          <div className="option-title">Developer Mode</div>
          <div className="option-description">
            Show developer tools and console in the popup interface for debugging purposes.
          </div>
          <div className="flex items-center mt-3">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.devModeEnabled}
                onChange={handleToggleChange('devModeEnabled')}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="ml-2 text-sm text-gray-700">
              {settings.devModeEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h2 className="options-section text-lg font-medium mb-4">Interface Settings</h2>
        
        {/* Keyboard shortcut */}
        <div className="option-group">
          <div className="option-title">Keyboard Shortcut</div>
          <div className="option-description">
            Set a keyboard shortcut to quickly open the Save to Pocket popup.
          </div>
          <div className="bg-gray-100 p-2 rounded mt-2 mb-2 inline-block font-mono text-sm">
            {keyboardShortcut || 'Not set'}
          </div>
          <button
            onClick={openShortcutSettings}
            className="pocket-button"
          >
            Configure Shortcuts
          </button>
        </div>
        
        {/* Auto close */}
        <div className="option-group">
          <div className="option-title">Popup Auto-Close</div>
          <div className="option-description">
            Set how long the popup stays open after saving an item (in seconds). Set to 0 to disable auto-close.
          </div>
          <div className="flex items-center mt-3">
            <input
              type="number"
              value={settings.popupCloseInterval}
              onChange={handleNumberChange('popupCloseInterval')}
              min="0"
              max="60"
              className="w-16 border p-1 rounded text-sm"
            />
            <span className="ml-2 text-sm text-gray-700">seconds</span>
          </div>
        </div>
      </div>
      
      <div className="text-right">
        <button
          onClick={resetSettings}
          className="pocket-button"
        >
          Reset to Defaults
        </button>
      </div>
      
      <div className="mt-6 text-center text-sm text-gray-500">
        Save to Pocket Extension v1.0
      </div>
    </div>
  );
};

// Initialize the options page
const init = () => {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root element not found');
  }
  
  const root = createRoot(container);
  root.render(
    <Providers>
      <OptionsPage />
    </Providers>
  );
};

// Start the app
document.addEventListener('DOMContentLoaded', init);

export default OptionsPage; 