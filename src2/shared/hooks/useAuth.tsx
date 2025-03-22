import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { initializeAuth } from '../api/authApi';
import { getAccessToken, removeAccessToken, getUsername } from '../utils/storage';
import { AuthState } from '../types';

// Default state
const defaultAuthState: AuthState = {
  isAuthenticated: false,
  accessToken: null,
  username: null,
  isAuthenticating: false,
  error: null
};

// Track last refresh time to prevent excessive refreshing
let lastRefreshTime = 0;
const REFRESH_COOLDOWN = 60000; // 1 minute in milliseconds

// Create context
const AuthContext = createContext<{
  auth: AuthState;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}>({
  auth: defaultAuthState,
  login: async () => {},
  logout: async () => {},
  refreshAuth: async () => {}
});

// Provider component
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>(defaultAuthState);

  // Check if user is already authenticated
  const refreshAuth = async () => {
    try {
      const now = Date.now();
      // Skip if we refreshed recently (within the cooldown period)
      if (now - lastRefreshTime < REFRESH_COOLDOWN) {
        console.log('[Auth] Skipping refresh - last refresh was too recent');
        return;
      }
      
      console.log('[Auth] Checking authentication status...');
      lastRefreshTime = now;
      
      const token = await getAccessToken();
      console.log('[Auth] Access token found:', !!token);
      
      if (token) {
        const username = await getUsername();
        console.log('[Auth] Username found:', !!username);
        
        setAuth({
          isAuthenticated: true,
          accessToken: token,
          username: username,
          isAuthenticating: false,
          error: null
        });
        
        console.log('[Auth] User is authenticated');
        return;
      }
      
      console.log('[Auth] User is not authenticated');
    } catch (error) {
      console.error('[Auth] Error checking authentication status:', error);
    }
  };

  // Check auth on component mount
  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async () => {
    try {
      setAuth({
        ...auth,
        isAuthenticating: true,
        error: null
      });

      const result = await initializeAuth();
      
      if (result.success) {
        await refreshAuth();
      } else {
        setAuth({
          ...auth,
          isAuthenticating: false,
          error: result.error || 'Authentication failed'
        });
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      setAuth({
        ...auth,
        isAuthenticating: false,
        error: error instanceof Error ? error.message : 'Unknown error during login'
      });
    }
  };

  const logout = async () => {
    try {
      await removeAccessToken();
      setAuth({
        isAuthenticated: false,
        accessToken: null,
        username: null,
        isAuthenticating: false,
        error: null
      });
      console.log('[Auth] User logged out');
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      setAuth({
        ...auth,
        error: error instanceof Error ? error.message : 'Unknown error during logout'
      });
    }
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using the auth context
export const useAuth = () => useContext(AuthContext); 