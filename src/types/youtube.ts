/**
 * YouTube OAuth 2.0 Authentication Types
 */

/**
 * YouTube scopes for API access
 */
export type YouTubeScope =
  | 'https://www.googleapis.com/auth/youtube.upload'
  | 'https://www.googleapis.com/auth/youtube'
  | 'https://www.googleapis.com/auth/yt-analytics.readonly';

/**
 * YouTube auth status
 */
export type YouTubeAuthStatus = 'not_connected' | 'connected';

/**
 * Database record for YouTube authentication
 */
export interface YouTubeAuthRecord {
  id: number;
  channel_id: string;
  channel_title: string | null;
  access_token: string;
  refresh_token: string;
  token_type: string;
  scopes: string; // Comma-separated scopes
  expires_at: number; // Unix timestamp in seconds
  created_at: string;
  updated_at: string;
}

/**
 * OAuth state for CSRF protection (stored in KV)
 */
export interface OAuthState {
  state: string;
  createdAt: number;
}

/**
 * YouTube token response from OAuth callback
 */
export interface YouTubeTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * YouTube channel info from API
 */
export interface YouTubeChannelInfo {
  id: string;
  title: string;
}

/**
 * Auth status response for API
 */
export interface AuthStatusResponse {
  isConnected: boolean;
  channel?: {
    id: string;
    title: string;
  };
  scopes?: string[];
  expiresAt?: number; // Unix timestamp
  tokenExpiresIn?: number; // Seconds until expiry
}

/**
 * Auth URL response for API
 */
export interface AuthUrlResponse {
  url: string;
  state: string;
}

/**
 * Token refresh response
 */
export interface RefreshTokenResponse {
  success: boolean;
  expiresAt?: number;
  error?: string;
}

/**
 * OAuth error types
 */
export type OAuthError =
  | 'invalid_state'
  | 'no_code'
  | 'token_exchange_failed'
  | 'channel_fetch_failed'
  | 'save_failed'
  | 'not_authenticated';
