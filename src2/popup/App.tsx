import React, { useState, useEffect } from 'react';
import { useAuth, useSettings } from '../shared/hooks';
import { Providers } from '../shared/providers/Providers';
import { SaveForm, UnauthorizedView, DevConsole } from '../components';

const PopupApp: React.FC = () => {
  const { auth } = useAuth();
  const { settings } = useSettings();
  const [closeTimer, setCloseTimer] = useState<number | null>(null);
  const [showDevConsole, setShowDevConsole] = useState(false);
  
  // Set up auto-close timer when settings change
  useEffect(() => {
    if (settings.popupCloseInterval > 0) {
      const timer = window.setTimeout(() => {
        window.close();
      }, settings.popupCloseInterval * 1000);
      
      setCloseTimer(timer);
      
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }
    
    return undefined;
  }, [settings.popupCloseInterval]);
  
  // Clear the timer when user interacts with the popup
  const handleUserActivity = () => {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      setCloseTimer(null);
    }
  };
  
  // Handle successful save
  const handleSaved = () => {
    if (settings.popupCloseInterval > 0) {
      const timer = window.setTimeout(() => {
        window.close();
      }, settings.popupCloseInterval * 1000);
      
      setCloseTimer(timer);
    }
  };
  
  // Toggle developer console
  const toggleDevConsole = () => {
    setShowDevConsole(!showDevConsole);
  };
  
  return (
    <div className="w-80 min-h-[300px] max-h-[600px] bg-white css-loaded-indicator" onClick={handleUserActivity}>
      <header className="pocket-header">
        <h1 className="text-lg font-medium">Save to Pocket</h1>
      </header>
      
      <main className="p-0">
        {auth.isAuthenticated ? (
          <SaveForm onSaved={handleSaved} />
        ) : (
          <UnauthorizedView />
        )}
      </main>
      
      {settings.devModeEnabled && (
        <div className="border-t border-gray-200 p-2">
          <button 
            onClick={toggleDevConsole}
            className="text-xs text-gray-600 hover:text-gray-800"
          >
            {showDevConsole ? 'Hide Developer Console' : 'Show Developer Console'}
          </button>
          {showDevConsole && <DevConsole visible={showDevConsole} />}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <Providers>
      <PopupApp />
    </Providers>
  );
};

export default App; 