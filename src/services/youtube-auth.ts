/**
 * YouTube OAuth 2.0 Service
 * Handles OAuth flow, token management, and channel operations
 */

import type {
  YouTubeAuthRecord,
  YouTubeTokenResponse,
  YouTubeChannelInfo,
  AuthStatusResponse,
  OAuthError,
} from '../types/youtube.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('YouTubeAuth');

// OAuth scopes
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

// OAuth state TTL in seconds (5 minutes)
const OAUTH_STATE_TTL = 300;

/**
 * YouTube OAuth Service Class
 */
export class YouTubeAuthService {
  private db: D1Database;
  private kv: KVNamespace;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(
    db: D1Database,
    kv: KVNamespace,
    clientId: string,
    clientSecret: string,
    redirectUri: string
  ) {
    this.db = db;
    this.kv = kv;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }

  /**
   * Get current authentication status
   */
  async getAuthStatus(reqId: string): Promise<AuthStatusResponse> {
    log.info(reqId, 'Fetching auth status');

    try {
      const record = await this.db
        .prepare('SELECT * FROM youtube_auth ORDER BY id DESC LIMIT 1')
        .first<YouTubeAuthRecord>();

      if (!record) {
        return { isConnected: false };
      }

      const now = Math.floor(Date.now() / 1000);
      const tokenExpiresIn = record.expires_at - now;

      return {
        isConnected: true,
        channel: {
          id: record.channel_id,
          title: record.channel_title || 'Unknown Channel',
        },
        scopes: record.scopes.split(','),
        expiresAt: record.expires_at,
        tokenExpiresIn: tokenExpiresIn > 0 ? tokenExpiresIn : 0,
      };
    } catch (error) {
      log.error(reqId, 'Failed to fetch auth status', error as Error);
      throw error;
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(reqId: string): Promise<{ url: string; state: string }> {
    log.info(reqId, 'Generating OAuth URL');

    // Generate random state for CSRF protection
    const state = this.generateRandomState();

    // Store state in KV with TTL
    await this.kv.put(`oauth_state:${state}`, JSON.stringify({ createdAt: Date.now() }), {
      expirationTtl: OAUTH_STATE_TTL,
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: SCOPES.join(' '),
      response_type: 'code',
      state: state,
      access_type: 'offline', // Get refresh token
      prompt: 'consent', // Force consent to ensure refresh token is returned
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    log.info(reqId, 'OAuth URL generated', { state });

    return { url, state };
  }

  /**
   * Verify OAuth state
   */
  async verifyState(reqId: string, state: string): Promise<boolean> {
    log.debug(reqId, 'Verifying OAuth state', { state });

    const stateData = await this.kv.get(`oauth_state:${state}`);
    if (!stateData) {
      log.warn(reqId, 'Invalid or expired OAuth state', { state });
      return false;
    }

    // Delete the state after verification (one-time use)
    await this.kv.delete(`oauth_state:${state}`);

    return true;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    reqId: string,
    code: string
  ): Promise<YouTubeTokenResponse> {
    log.info(reqId, 'Exchanging code for tokens');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(reqId, 'Token exchange failed', new Error(errorText), {
        status: response.status,
      });
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokens = (await response.json()) as YouTubeTokenResponse;

    log.info(reqId, 'Tokens obtained successfully', {
      expiresIn: tokens.expires_in,
      hasRefreshToken: !!tokens.refresh_token,
    });

    return tokens;
  }

  /**
   * Fetch channel info from YouTube API
   */
  async fetchChannelInfo(
    reqId: string,
    accessToken: string
  ): Promise<YouTubeChannelInfo> {
    log.info(reqId, 'Fetching channel info');

    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log.error(reqId, 'Channel fetch failed', new Error(errorText), {
        status: response.status,
      });
      throw new Error(`Channel fetch failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error('No channel found');
    }

    const channel = data.items[0];
    const channelInfo: YouTubeChannelInfo = {
      id: channel.id,
      title: channel.snippet.title,
    };

    log.info(reqId, 'Channel info fetched', { channelId: channelInfo.id });

    return channelInfo;
  }

  /**
   * Save or update YouTube auth record
   */
  async saveAuthRecord(
    reqId: string,
    channelId: string,
    channelTitle: string,
    tokens: YouTubeTokenResponse
  ): Promise<void> {
    log.info(reqId, 'Saving auth record', { channelId });

    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

    try {
      // Check if record exists
      const existing = await this.db
        .prepare('SELECT id FROM youtube_auth WHERE channel_id = ?')
        .bind(channelId)
        .first();

      if (existing) {
        // Update existing record
        await this.db
          .prepare(
            `UPDATE youtube_auth
             SET channel_title = ?, access_token = ?, refresh_token = ?,
                 scopes = ?, expires_at = ?, updated_at = datetime('now')
             WHERE channel_id = ?`
          )
          .bind(
            channelTitle,
            tokens.access_token,
            tokens.refresh_token,
            tokens.scope,
            expiresAt,
            channelId
          )
          .run();

        log.info(reqId, 'Auth record updated', { channelId });
      } else {
        // Insert new record
        await this.db
          .prepare(
            `INSERT INTO youtube_auth
             (channel_id, channel_title, access_token, refresh_token, scopes, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            channelId,
            channelTitle,
            tokens.access_token,
            tokens.refresh_token,
            tokens.scope,
            expiresAt
          )
          .run();

        log.info(reqId, 'Auth record created', { channelId });
      }
    } catch (error) {
      log.error(reqId, 'Failed to save auth record', error as Error, {
        channelId,
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(reqId: string): Promise<{ expiresAt: number }> {
    log.info(reqId, 'Refreshing access token');

    const record = await this.db
      .prepare('SELECT refresh_token FROM youtube_auth ORDER BY id DESC LIMIT 1')
      .first<{ refresh_token: string }>();

    if (!record) {
      log.warn(reqId, 'No auth record found for refresh');
      throw new Error('not_authenticated');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: record.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(reqId, 'Token refresh failed', new Error(errorText), {
        status: response.status,
      });
      throw new Error('Token refresh failed');
    }

    const tokens = (await response.json()) as YouTubeTokenResponse;
    const expiresAt = Math.floor(Date.now() / 1000) + tokens.expires_in;

    // Update access token and expiry in database
    await this.db
      .prepare(
        `UPDATE youtube_auth
         SET access_token = ?, expires_at = ?, updated_at = datetime('now')
         WHERE id = (SELECT id FROM youtube_auth ORDER BY id DESC LIMIT 1)`
      )
      .bind(tokens.access_token, expiresAt)
      .run();

    log.info(reqId, 'Access token refreshed', { expiresAt });

    return { expiresAt };
  }

  /**
   * Delete auth record (disconnect)
   */
  async deleteAuthRecord(reqId: string): Promise<void> {
    log.info(reqId, 'Deleting auth record');

    await this.db.prepare('DELETE FROM youtube_auth').run();

    log.info(reqId, 'Auth record deleted');
  }

  /**
   * Get access token (with auto-refresh if needed)
   */
  async getAccessToken(reqId: string): Promise<string> {
    const record = await this.db
      .prepare('SELECT access_token, expires_at FROM youtube_auth ORDER BY id DESC LIMIT 1')
      .first<{ access_token: string; expires_at: number }>();

    if (!record) {
      throw new Error('not_authenticated');
    }

    const now = Math.floor(Date.now() / 1000);

    // Auto-refresh if token expires in less than 5 minutes
    if (record.expires_at - now < 300) {
      log.info(reqId, 'Token expiring soon, auto-refreshing');
      await this.refreshAccessToken(reqId);

      const refreshed = await this.db
        .prepare('SELECT access_token FROM youtube_auth ORDER BY id DESC LIMIT 1')
        .first<{ access_token: string }>();

      return refreshed?.access_token || '';
    }

    return record.access_token;
  }

  /**
   * Generate random state string for OAuth
   */
  private generateRandomState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
  }
}
