// Auth Types
export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  username: string | null;
  isAuthenticating: boolean;
  error: string | null;
}

// Tag Types
export interface Tag {
  name: string;
}

export interface TagsState {
  tags: string[];
  lastFetch: number;
  isLoading: boolean;
  error: string | null;
}

// Pocket Item Types
export interface PocketItem {
  itemId: string;
  url: string;
  title: string;
  tags: string[];
  exists: boolean;
  timestamp: number;
}

export interface PocketStatus {
  exists: boolean;
  timestamp: number;
  tags: string[];
  title: string | null;
  itemId: string | null;
}

// Tab Types
export interface TabInfo {
  url: string;
  title: string;
  pocketStatus: PocketStatus | null;
  timestamp: number;
  fromCache?: boolean;
}

export interface TabCache {
  [url: string]: TabInfo;
}

// Settings Types
export interface Settings {
  tagSuggestionsEnabled: boolean;
  popupCloseInterval: number;
  devModeEnabled: boolean;
  tabCacheEnabled: boolean;
  keyboardShortcut: string;
}

// API Response Types
export interface RequestTokenResponse {
  code: string;
}

export interface AccessTokenResponse {
  access_token: string;
  username: string;
}

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
    login_required: string;
    has_image: string;
    has_video: string;
    is_index: string;
    is_article: string;
    used_fallback: string;
    lang: string;
    time_first_parsed: string;
    authors: Record<string, { item_id: string; name: string; url: string }>;
    images: Record<string, { item_id: string; src: string; width: string; height: string }>;
    videos: Record<string, any>;
    given_url: string;
    given_title: string;
    resolved_normal_url: string;
    time_added: string;
    time_updated: string;
    time_read: string;
    time_favorited: string;
    status: string;
    sort_id: string;
    resolved_title: string;
    resolved_sort_id: string;
    userpict_id: string;
  };
  status: number;
}

export interface PocketGetResponse {
  status: number;
  complete: number;
  list: Record<string, PocketListItem>;
  since: number;
}

export interface PocketListItem {
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
  sort_id: number;
  resolved_title: string;
  resolved_url: string;
  excerpt: string;
  is_article: string;
  is_index: string;
  has_video: string;
  has_image: string;
  word_count: string;
  tags?: Record<string, { item_id: string; tag: string }>;
}

export interface PocketSendResponse {
  action_results: boolean[];
  status: number;
} 