export interface TagsState {
  tags: string[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  username: string | null;
  isAuthenticating: boolean;
  error: string | null;
}

export interface Settings {
  popupCloseInterval: number;
  devModeEnabled: boolean;
  tagSuggestionsEnabled: boolean;
  tabCacheEnabled: boolean;
  keyboardShortcut: string;
} 