/**
 * YouTube OAuth status card component
 * Displays YouTube connection status, channel info, token status, scopes, and actions
 */
import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { authenticatedFetch, getAuthHeaders } from '../lib/auth.js';
import { baseStyles, buttonStyles, badgeStyles, loadingStyles } from '../styles/shared-styles.js';

interface YouTubeAuthStatus {
  isConnected: boolean;
  channel?: {
    id: string;
    title: string;
  };
  scopes?: string[];
  expiresAt?: number;
  tokenExpiresIn?: number;
}

@customElement('youtube-oauth-status-card')
export class YouTubeOAuthStatusCard extends LitElement {
  static styles = [baseStyles, buttonStyles, badgeStyles, loadingStyles, css`
    .settings-section {
      background: #ffffff;
      border: 3px solid #0a0a0a;
      box-shadow: 4px 4px 0 #0a0a0a;
      padding: 2rem;
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .settings-section::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: #e63946;
    }

    .section-title {
      font-family: 'Zen Tokyo Zoo', sans-serif;
      font-size: clamp(1.25rem, 3vw, 1.5rem);
      font-weight: 400;
      color: #0a0a0a;
      margin: 0 0 1rem 0;
      text-transform: uppercase;
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .description {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      font-size: 0.9375rem;
      color: #58544c;
      margin: 0 0 1.5rem 0;
      line-height: 1.6;
    }

    .channel-info {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f5f3f0;
      border: 2px solid #0a0a0a;
    }

    .channel-name {
      font-family: 'Space Mono', monospace;
      font-size: 0.875rem;
      font-weight: 700;
      color: #0a0a0a;
      text-transform: uppercase;
      margin: 0 0 0.5rem 0;
    }

    .channel-id {
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
      color: #58544c;
      margin: 0;
    }

    .token-info {
      margin: 1rem 0;
      padding: 1rem;
      background: #f5f3f0;
      border: 2px solid #0a0a0a;
    }

    .token-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid #e8e6e1;
      font-family: 'Space Mono', monospace;
      font-size: 0.75rem;
    }

    .token-info-row:last-child {
      border-bottom: none;
    }

    .token-label {
      color: #58544c;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .token-value {
      color: #0a0a0a;
      font-weight: 700;
    }

    .token-expires-soon {
      color: #f97316;
    }

    .token-expired {
      color: #e63946;
    }

    .scopes-list {
      margin: 1.5rem 0;
    }

    .scopes-title {
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      font-weight: 700;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.75rem;
    }

    .scope-item {
      padding: 0.375rem 0.625rem;
      background: #f5f3f0;
      border: 1px solid #0a0a0a;
      display: inline-block;
      margin: 0.125rem;
      font-family: 'Space Mono', monospace;
      font-size: 0.6875rem;
      color: #0a0a0a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .button-group {
      display: flex;
      gap: 0.75rem;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    @media (max-width: 640px) {
      .settings-section {
        padding: 1.5rem;
      }

      .button-group {
        flex-direction: column;
      }

      .button {
        width: 100%;
        text-align: center;
      }
    }
  `];

  @property({ type: Boolean })
  isYouTubeConnected: boolean = false;

  @state()
  private loading: boolean = true;

  @state()
  private connecting: boolean = false;

  @state()
  private disconnecting: boolean = false;

  @state()
  private refreshing: boolean = false;

  @state()
  private error: string | null = null;

  @state()
  private message: string | null = null;

  @state()
  private authStatus: YouTubeAuthStatus | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.loadStatus();
  }

  private async loadStatus() {
    try {
      this.loading = true;
      this.error = null;
      this.message = null;

      const response = await authenticatedFetch('/api/youtube/status');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.authStatus = data.data;
        (this as unknown as { isYouTubeConnected: boolean }).isYouTubeConnected = data.data.isConnected;
      } else {
        throw new Error(data.error || 'Failed to load status');
      }
    } catch (err) {
      // authenticatedFetch handles 401 by redirecting, so we only see other errors
      this.error = err instanceof Error ? err.message : 'Failed to load status';
    } finally {
      this.loading = false;
    }
  }

  private async startOAuth() {
    try {
      this.connecting = true;
      this.error = null;

      const response = await authenticatedFetch('/api/youtube/auth/url');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data.url) {
        // Redirect to Google OAuth
        window.location.href = data.data.url;
      } else {
        throw new Error('Failed to generate authorization URL');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to start OAuth flow';
      this.connecting = false;
    }
  }

  private async refreshToken() {
    try {
      this.refreshing = true;
      this.error = null;

      const response = await authenticatedFetch('/api/youtube/refresh', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.message = 'Token refreshed successfully';
        await this.loadStatus();
        setTimeout(() => {
          this.message = null;
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to refresh token');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to refresh token';
    } finally {
      this.refreshing = false;
    }
  }

  private async disconnect() {
    if (!confirm('Are you sure you want to disconnect your YouTube channel?')) {
      return;
    }

    try {
      this.disconnecting = true;
      this.error = null;

      const response = await authenticatedFetch('/api/youtube/auth', {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        this.message = 'Disconnected successfully';
        this.authStatus = null;
        (this as unknown as { isYouTubeConnected: boolean }).isYouTubeConnected = false;
      } else {
        throw new Error(data.error || 'Failed to disconnect');
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to disconnect';
    } finally {
      this.disconnecting = false;
    }
  }

  private formatTokenExpires(expiresIn: number | undefined): string {
    if (expiresIn === undefined) return 'Unknown';
    if (expiresIn <= 0) return 'Expired';

    const hours = Math.floor(expiresIn / 3600);
    const minutes = Math.floor((expiresIn % 3600) / 60);

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  private getTokenExpiryClass(expiresIn: number | undefined): string {
    if (expiresIn === undefined) return '';
    if (expiresIn <= 0) return 'token-expired';
    if (expiresIn < 300) return 'token-expires-soon'; // Less than 5 minutes
    return '';
  }

  private formatScope(scope: string): string {
    const scopeNames: Record<string, string> = {
      'https://www.googleapis.com/auth/youtube.upload': 'Upload Videos',
      'https://www.googleapis.com/auth/youtube': 'Manage Account',
      'https://www.googleapis.com/auth/yt-analytics.readonly': 'View Analytics',
    };
    return scopeNames[scope] || scope;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="settings-section">
          <div class="loading-row">
            <span class="loading-spinner"></span>
            <span>Loading settings...</span>
          </div>
        </div>
      `;
    }

    return html`
      <div class="settings-section">
        <h2 class="section-title">
          YouTube Connection
          <span class="badge ${this.isYouTubeConnected ? 'connected' : 'not-connected'}">
            ${this.isYouTubeConnected ? 'Connected' : 'Not Connected'}
          </span>
        </h2>

        <p class="description">
          Connect your YouTube channel to enable video uploads. The app will request
          permission to upload videos and access channel analytics.
        </p>

        ${this.authStatus?.channel ? html`
          <div class="channel-info">
            <p class="channel-name">${this.authStatus.channel.title}</p>
            <p class="channel-id">Channel ID: ${this.authStatus.channel.id}</p>
          </div>
        ` : ''}

        ${this.isYouTubeConnected && this.authStatus ? html`
          <div class="token-info">
            <div class="token-info-row">
              <span class="token-label">Token Status:</span>
              <span class="token-value">Connected</span>
            </div>
            <div class="token-info-row">
              <span class="token-label">Expires In:</span>
              <span class="token-value ${this.getTokenExpiryClass(this.authStatus.tokenExpiresIn)}">
                ${this.formatTokenExpires(this.authStatus.tokenExpiresIn)}
              </span>
            </div>
          </div>
        ` : ''}

        ${this.authStatus?.scopes && this.authStatus.scopes.length > 0 ? html`
          <div class="scopes-list">
            <p class="scopes-title">Permissions Granted:</p>
            ${this.authStatus.scopes.map(scope => html`
              <span class="scope-item">${this.formatScope(scope)}</span>
            `)}
          </div>
        ` : ''}

        ${this.error ? html`
          <div class="error-message">${this.error}</div>
        ` : ''}

        ${this.message ? html`
          <div class="success-message">${this.message}</div>
        ` : ''}

        <div class="button-group">
          ${this.isYouTubeConnected ? html`
            <button
              class="button button-secondary"
              ?disabled=${this.refreshing}
              @click=${this.refreshToken}
            >
              ${this.refreshing ? '[ REFRESHING... ]' : '[ Refresh Token ]'}
            </button>
            <button
              class="button button-danger"
              ?disabled=${this.disconnecting}
              @click=${this.disconnect}
            >
              ${this.disconnecting ? '[ DISCONNECTING... ]' : '[ Disconnect Channel ]'}
            </button>
          ` : html`
            <button
              class="button button-primary"
              ?disabled=${this.connecting}
              @click=${this.startOAuth}
            >
              ${this.connecting ? '[ CONNECTING... ]' : '[ Connect YouTube Channel ]'}
            </button>
          `}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'youtube-oauth-status-card': YouTubeOAuthStatusCard;
  }
}
